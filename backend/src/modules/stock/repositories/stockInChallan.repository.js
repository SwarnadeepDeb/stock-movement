import { and, eq, sql } from "drizzle-orm";

import { stockInChallan, stockInChallanEvent } from "../schemas/stockInChallan.schema.js";

// Per-challan aggregates, all correlated subqueries keyed on stock_in_transactions.challan_id.
// A challan's pieces are what its stock_in_entries ledger says were added, so the numbers here
// always agree with Current Stock.
const piecesSql = sql`(select coalesce(sum(e.quantity_added), 0) from stock_in_entries e join stock_in_transactions t on t.id = e.stock_in_transaction_id where t.challan_id = c.id)::int`;
const setsSql = sql`(select coalesce(sum(t.total_sets_received), 0) from stock_in_transactions t where t.challan_id = c.id)::int`;
const semiSql = sql`(select coalesce(sum(b.quantity), 0) from stock_in_bundle b join stock_in_transactions t on t.id = b.stock_in_transaction_id where t.challan_id = c.id)::int`;
const looseSql = sql`(select coalesce(sum(l.quantity), 0) from stock_in_loose_pieces l join stock_in_transactions t on t.id = l.stock_in_transaction_id where t.challan_id = c.id)::int`;
const defectiveSql = sql`(select coalesce(sum(t.defective_pieces), 0) from stock_in_transactions t where t.challan_id = c.id)::int`;
const editCountSql = sql`(select count(*) from stock_in_challan_events ev where ev.challan_id = c.id and ev.kind = 'EDIT')::int`;
const qrCountSql = sql`(select count(distinct q.id) from stock_item_qr q join stock_items si on si.id = q.stock_item_id join stock_in_transactions t on t.id = si.stock_in_transaction_id where t.challan_id = c.id and q.status = 'ACTIVE')::int`;
const printedCountSql = sql`(select count(distinct q.id) from stock_item_qr q join stock_items si on si.id = q.stock_item_id join stock_in_transactions t on t.id = si.stock_in_transaction_id join print_job_items pji on pji.stock_item_qr_id = q.id where t.challan_id = c.id and q.status = 'ACTIVE')::int`;
const designsSql = sql`(select coalesce(jsonb_agg(jsonb_build_object('code', d.code, 'name', d.name, 'pieces', g.pcs) order by d.code), '[]'::jsonb)
    from (select cv.design_id, sum(coalesce(ep.p, 0)) as pcs
          from stock_in_transactions t
          join color_variants cv on cv.id = t.variant_id
          left join (select stock_in_transaction_id, sum(quantity_added) as p from stock_in_entries group by 1) ep on ep.stock_in_transaction_id = t.id
          where t.challan_id = c.id group by cv.design_id) g
    join designs d on d.id = g.design_id)`;

function filterFragments({ id, search, jobber, dateRange, from, to, status }) {
    const where = [];

    if (id) where.push(sql`c.id = ${id}`);
    if (status === "active") where.push(sql`c.status = 'ACTIVE'`);
    if (status === "defects") where.push(sql`c.status = 'ACTIVE' and ${defectiveSql} > 0`);
    if (status === "edited") where.push(sql`${editCountSql} > 0`);
    if (status === "dropped") where.push(sql`c.status = 'DROPPED'`);

    if (jobber) where.push(sql`c.jobber_name = ${jobber}`);

    if (dateRange === "custom") {
        if (from) where.push(sql`c.stock_date >= ${from}::date`);
        if (to) where.push(sql`c.stock_date <= ${to}::date`);
    } else if (dateRange === "90+") {
        where.push(sql`c.stock_date < current_date - 90`);
    } else if (dateRange) {
        where.push(sql`c.stock_date >= current_date - ${Number(dateRange)}::int`);
    }

    if (search) {
        const like = `%${search}%`;
        where.push(sql`(
            ('SF-' || lpad(c.serial::text, 4, '0')) ilike ${like}
            or c.serial::text ilike ${like}
            or c.challan_no ilike ${like}
            or c.issued_challan_no ilike ${like}
            or c.jobber_name ilike ${like}
            or c.remarks ilike ${like}
            or exists (select 1 from stock_in_transactions t
                       join color_variants cv on cv.id = t.variant_id
                       join designs d on d.id = cv.design_id
                       where t.challan_id = c.id and (d.code ilike ${like} or d.name ilike ${like} or cv.color_name ilike ${like}))
        )`);
    }

    return where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;
}

function orderFragment(sort) {
    if (sort === "pcs") return sql`order by total_pieces desc, c.serial desc`;
    if (sort === "old") return sql`order by c.stock_date asc, c.serial asc`;
    return sql`order by c.stock_date desc, c.serial desc`;
}

class StockInChallanRepository {
    async create(tx, data) {
        const [row] = await tx.insert(stockInChallan).values(data).returning();
        return row;
    }

    async findById(tx, id) {
        const [row] = await tx.select().from(stockInChallan).where(eq(stockInChallan.id, id)).limit(1);
        return row;
    }

    async findByIdForUpdate(tx, id) {
        const result = await tx.execute(sql`select * from stock_in_challans where id = ${id} for update`);
        return result.rows[0] ?? null;
    }

    // Serial numbers only ever move forward from the highest ever issued (dropped challans keep
    // theirs). The advisory lock serialises concurrent registrations so two inwards can't both
    // read the same max.
    async issueNextSerial(tx) {
        await tx.execute(sql`select pg_advisory_xact_lock(90210)`);
        const result = await tx.execute(sql`select coalesce(max(serial), 0) + 1 as next from stock_in_challans`);
        return Number(result.rows[0].next);
    }

    async peekNextSerial(tx) {
        const result = await tx.execute(sql`select coalesce(max(serial), 0) + 1 as next from stock_in_challans`);
        return Number(result.rows[0].next);
    }

    async findActiveDuplicate(tx, { jobberName, challanNo, excludeId }) {
        const conditions = [
            eq(stockInChallan.status, "ACTIVE"),
            eq(stockInChallan.jobberName, jobberName),
            sql`lower(${stockInChallan.challanNo}) = lower(${challanNo})`,
        ];
        if (excludeId) conditions.push(sql`${stockInChallan.id} <> ${excludeId}`);
        const [row] = await tx.select().from(stockInChallan).where(and(...conditions)).limit(1);
        return row;
    }

    async update(tx, id, data) {
        const [row] = await tx.update(stockInChallan).set(data).where(eq(stockInChallan.id, id)).returning();
        return row;
    }

    async addEvent(tx, data) {
        const [row] = await tx.insert(stockInChallanEvent).values(data).returning();
        return row;
    }

    async findEvents(tx, challanId) {
        const result = await tx.execute(sql`select id, kind, note, changes, actor, created_at from stock_in_challan_events where challan_id = ${challanId} order by created_at asc, id asc`);
        return result.rows;
    }

    async list(tx, filters) {
        const { sort, limit, offset } = filters;
        const result = await tx.execute(sql`
            select c.id, c.serial, c.jobber_name, c.challan_no, c.issued_challan_no, c.stock_date, c.status, c.remarks,
                   c.entered_by, c.created_at,
                   ${piecesSql} as total_pieces, ${setsSql} as sets, ${semiSql} as semi_sets, ${looseSql} as loose,
                   ${defectiveSql} as defective, ${editCountSql} as edit_count,
                   ${qrCountSql} as qr_count, ${printedCountSql} as printed_count,
                   ${designsSql} as designs,
                   (select count(*) from stock_in_transactions t where t.challan_id = c.id)::int as transaction_count,
                   (select min(t.id) from stock_in_transactions t where t.challan_id = c.id) as first_transaction_id
            from stock_in_challans c
            ${filterFragments(filters)}
            ${orderFragment(sort)}
            limit ${limit} offset ${offset}`);
        return result.rows;
    }

    async count(tx, filters) {
        const result = await tx.execute(sql`select count(*)::int as n from stock_in_challans c ${filterFragments(filters)}`);
        return result.rows[0].n;
    }

    // Segment badges next to the status tabs (Active / With defects / Edited / Dropped / All).
    async statusCounts(tx) {
        const result = await tx.execute(sql`
            select count(*)::int as "all",
                   count(*) filter (where c.status = 'ACTIVE')::int as active,
                   count(*) filter (where c.status = 'ACTIVE' and ${defectiveSql} > 0)::int as defects,
                   count(*) filter (where ${editCountSql} > 0)::int as edited,
                   count(*) filter (where c.status = 'DROPPED')::int as dropped
            from stock_in_challans c`);
        return result.rows[0];
    }

    async serialRange(tx) {
        const result = await tx.execute(sql`select coalesce(min(serial), 0)::int as first, coalesce(max(serial), 0)::int as last from stock_in_challans`);
        const dropped = await tx.execute(sql`select serial from stock_in_challans where status = 'DROPPED' order by serial`);
        return { first: result.rows[0].first, last: result.rows[0].last, dropped: dropped.rows.map((row) => row.serial) };
    }

    async jobberSummary(tx) {
        const result = await tx.execute(sql`
            select c.jobber_name, count(*)::int as challan_count, sum(${piecesSql})::int as pieces
            from stock_in_challans c
            where c.status = 'ACTIVE'
            group by c.jobber_name
            order by pieces desc nulls last`);
        return result.rows;
    }

    async jobberNames(tx) {
        const result = await tx.execute(sql`select distinct jobber_name from stock_in_challans where jobber_name is not null order by 1`);
        return result.rows.map((row) => row.jobber_name);
    }

    // Dashboard strip: active challans dated this calendar month, and their pieces.
    async currentMonthTotals(tx) {
        const result = await tx.execute(sql`
            select count(*)::int as batches, coalesce(sum(${piecesSql}), 0)::int as pieces
            from stock_in_challans c
            where c.status = 'ACTIVE' and c.stock_date >= date_trunc('month', current_date)::date`);
        return result.rows[0];
    }

    async countPendingPrint(tx) {
        const result = await tx.execute(sql`
            select count(*)::int as n from stock_in_challans c
            where c.status = 'ACTIVE' and ${qrCountSql} > ${printedCountSql}`);
        return result.rows[0].n;
    }

    // One row per variant registration on the challan, with the design/variant identity and QC.
    async findLines(tx, challanId) {
        const result = await tx.execute(sql`
            select t.id as transaction_id, t.variant_id, t.total_sets_received as sets, t.defective_pieces, t.defect_category,
                   cv.color_name, cv.color_hex, d.id as design_id, d.code as design_code, d.name as design_name,
                   (select coalesce(sum(e.quantity_added), 0) from stock_in_entries e where e.stock_in_transaction_id = t.id)::int as pieces
            from stock_in_transactions t
            join color_variants cv on cv.id = t.variant_id
            join designs d on d.id = cv.design_id
            where t.challan_id = ${challanId}
            order by d.code, t.id`);
        return result.rows;
    }

    async findLineBundles(tx, transactionIds) {
        if (transactionIds.length === 0) return [];
        const result = await tx.execute(sql`
            select b.stock_in_transaction_id as transaction_id, b.id as bundle_id, b.quantity,
                   array_agg(ds.size_label order by ds.id) as sizes, array_agg(bp.quantity order by ds.id) as piece_quantities
            from stock_in_bundle b
            join stock_in_bundle_pieces bp on bp.bundle_id = b.id
            join design_sizes ds on ds.id = bp.design_size_id
            where b.stock_in_transaction_id in (${sql.join(transactionIds.map((id) => sql`${id}`), sql`, `)})
            group by b.id order by b.id`);
        return result.rows;
    }

    async findLineLoose(tx, transactionIds) {
        if (transactionIds.length === 0) return [];
        const result = await tx.execute(sql`
            select l.stock_in_transaction_id as transaction_id, ds.size_label, l.quantity
            from stock_in_loose_pieces l
            join design_sizes ds on ds.id = l.design_size_id
            where l.stock_in_transaction_id in (${sql.join(transactionIds.map((id) => sql`${id}`), sql`, `)})
            order by ds.id`);
        return result.rows;
    }

    async findLineSizes(tx, variantIds) {
        if (variantIds.length === 0) return [];
        const result = await tx.execute(sql`
            select ds.variant_id as variant_id, ds.size_label, ds.included_in_set
            from design_sizes ds
            where ds.variant_id in (${sql.join(variantIds.map((id) => sql`${id}`), sql`, `)}) and ds.is_active
            order by ds.id`);
        return result.rows;
    }

    async linkTransactionsToChallan(tx, challanId, { challanNo, stockDate }) {
        await tx.execute(sql`update stock_in_transactions set challan_no = ${challanNo}, stock_date = ${stockDate}::date where challan_id = ${challanId}`);
    }

    async findTransactionIds(tx, challanId) {
        const result = await tx.execute(sql`select id from stock_in_transactions where challan_id = ${challanId}`);
        return result.rows.map((row) => row.id);
    }

    // Everything the challan added to stock, per variant+size — what dropping must take back out.
    async findInventoryAdded(tx, challanId) {
        const result = await tx.execute(sql`
            select e.color_variant_id, e.design_size_id, sum(e.quantity_added)::int as quantity
            from stock_in_entries e join stock_in_transactions t on t.id = e.stock_in_transaction_id
            where t.challan_id = ${challanId}
            group by e.color_variant_id, e.design_size_id`);
        return result.rows;
    }

    async lockStockItems(tx, challanId) {
        const result = await tx.execute(sql`
            select si.id, si.status, si.custody_type
            from stock_items si join stock_in_transactions t on t.id = si.stock_in_transaction_id
            where t.challan_id = ${challanId} for update of si`);
        return result.rows;
    }

    async findActiveQrIds(tx, challanId) {
        const result = await tx.execute(sql`
            select q.id from stock_item_qr q
            join stock_items si on si.id = q.stock_item_id
            join stock_in_transactions t on t.id = si.stock_in_transaction_id
            where t.challan_id = ${challanId} and q.status = 'ACTIVE'`);
        return result.rows.map((row) => row.id);
    }
}

export default new StockInChallanRepository();
