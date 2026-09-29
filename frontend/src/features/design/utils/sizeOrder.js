// Garment sizes smallest → largest. Sizes in a set are always shown and saved in this order,
// whatever order they were clicked in (displayOrder on the backend follows it too).
const SIZE_RANK = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
// Spelled-out forms of the multi-X sizes rank alongside their short form.
const SIZE_ALIASES = { XXXL: "3XL", XXXXL: "4XL", XXXXXL: "5XL" };

const rankOf = (size) => {
  const key = size.trim().toUpperCase();
  return SIZE_RANK.indexOf(SIZE_ALIASES[key] ?? key);
};

// Known letter sizes first (in SIZE_RANK order), then numeric sizes ascending (e.g. 28, 30, 32),
// then any other custom size (e.g. "FREE SIZE") in the order it was given. Returns a new array.
export const sortSizes = (sizes) =>
  sizes
    .map((size, index) => ({ size, index, rank: rankOf(size), number: Number(size) }))
    .sort((a, b) => {
      const aKnown = a.rank !== -1;
      const bKnown = b.rank !== -1;
      if (aKnown || bKnown) return aKnown && bKnown ? a.rank - b.rank : aKnown ? -1 : 1;

      const aNumeric = Number.isFinite(a.number);
      const bNumeric = Number.isFinite(b.number);
      if (aNumeric || bNumeric) return aNumeric && bNumeric ? a.number - b.number : aNumeric ? -1 : 1;

      return a.index - b.index;
    })
    .map(({ size }) => size);
