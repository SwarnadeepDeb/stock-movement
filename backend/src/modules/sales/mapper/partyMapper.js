// DB row → API shape. normalizedName is an implementation detail of uniqueness and never leaves
// the server.
//
// Nullable fields map to "" rather than null because every consumer is a text input, and an
// input whose value is null is a React warning waiting to happen.
class PartyMapper {
    map(row) {
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            mobile: row.mobile ?? "",
            city: row.city ?? "",
            gst: row.gst ?? "",
            transport: row.transport ?? "",
            agent: row.agent ?? "",
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    mapMany(rows) {
        return rows.map((row) => this.map(row));
    }
}

export default new PartyMapper();
