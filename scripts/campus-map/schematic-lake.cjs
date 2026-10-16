/* Original cartographic symbol, not a survey of the lake's shoreline. */
function schematicLake(patio) {
  const points = patio.poligono.externo;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  const center = [(left + right) / 2, (bottom + top) / 2];
  // An arbitrary display size relative to the courtyard, not the lake's size.
  const radius = Math.min(right - left, top - bottom) / 6;
  const ring = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    return [
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ].map(value => Math.round(value * 1000) / 1000);
  });
  return { center, ring };
}

module.exports = { schematicLake };
