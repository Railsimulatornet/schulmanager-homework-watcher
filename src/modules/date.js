function dateGerman(date) {
  const value = String(date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(8,10)}.${value.slice(5,7)}.${value.slice(0,4)}`
    : value;
}

module.exports = { dateGerman };
