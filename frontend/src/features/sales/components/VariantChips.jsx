// The design/colour chips that let someone scan a list of documents and recognise the one they
// mean. Capped, because a form with twenty variants would otherwise push every other column off
// the row.
const VariantChips = ({ items, max = 4 }) => {
    const shown = items.slice(0, max);
    const rest = items.length - shown.length;

    return (
        <div className="flex flex-wrap gap-1.5">
            {shown.map((item) => (
                <span
                    key={item.colorVariantId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[11px] font-semibold text-[#1E1B4B]/80"
                >
                    <span className="h-2 w-2 rounded-full" style={{ background: item.colorHex }} />
                    {item.designCode} · {item.colorName}
                </span>
            ))}
            {rest > 0 && <span className="self-center text-[11px] text-[#1E1B4B]/45">+{rest} more</span>}
        </div>
    );
};

export default VariantChips;
