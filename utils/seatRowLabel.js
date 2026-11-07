const getSeatRowLabel = (index) => {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('Seat row index must be a non-negative integer');
  }

  let remaining = index;
  let label = '';
  while (remaining >= 0) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return label;
};

module.exports = getSeatRowLabel;
