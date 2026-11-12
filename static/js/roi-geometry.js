/* EchoMetrics 2.2 - ROI geometry. Coordinate units are ORIGINAL image pixels.
 * No implicit splines or smoothing. Functions are intentionally framework-free
 * to make geometric behavior independently testable.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EchoROI = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const copy = points => points.map(p => ({x: p.x, y: p.y}));
  function area(points) {
    if (points.length < 3) return 0;
    let twice = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      twice += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twice) / 2;
  }
  function pointSegmentDistance(point, start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const d2 = dx * dx + dy * dy;
    const t = d2 === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / d2));
    const projection = {x: start.x + t * dx, y: start.y + t * dy};
    return {distance: Math.sqrt(distance2(point, projection)), projection, t};
  }
  function nearestSegment(point, points) {
    if (points.length < 2) return null;
    let result = null;
    for (let i = 0; i < points.length; i++) {
      const d = pointSegmentDistance(point, points[i], points[(i + 1) % points.length]);
      if (!result || d.distance < result.distance) result = {index: i, ...d};
    }
    return result;
  }
  function perpendicularDistance(p, a, b) {
    return pointSegmentDistance(p, a, b).distance;
  }
  function simplifyOpen(points, tolerance) {
    if (points.length <= 2) return copy(points);
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [start, end] = stack.pop();
      let best = -1, max = tolerance;
      for (let i = start + 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[start], points[end]);
        if (d > max) { max = d; best = i; }
      }
      if (best !== -1) {
        keep[best] = 1;
        stack.push([start, best], [best, end]);
      }
    }
    return points.filter((p, i) => keep[i]).map(p => ({x: p.x, y: p.y}));
  }
  // If closed freehand stroke ends near its start, eliminate its duplicate endpoint.
  function simplifyFreehand(points, tolerance) {
    if (points.length < 3) return copy(points);
    const raw = copy(points);
    if (distance2(raw[0], raw[raw.length - 1]) <= tolerance * tolerance) raw.pop();
    // Reopen around the point farthest from the first vertex to prevent the
    // first/last nearly coincident points from collapsing the simplifier.
    let pivot = 1, far = 0;
    for (let i = 1; i < raw.length; i++) {
      const d = distance2(raw[0], raw[i]);
      if (d > far) { far = d; pivot = i; }
    }
    const first = simplifyOpen(raw.slice(0, pivot + 1), tolerance);
    const second = simplifyOpen(raw.slice(pivot).concat([raw[0]]), tolerance);
    return first.concat(second.slice(1, -1));
  }
  function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }
  function onSegment(a, b, p) {
    return p.x >= Math.min(a.x,b.x) - 1e-9 && p.x <= Math.max(a.x,b.x) + 1e-9 &&
           p.y >= Math.min(a.y,b.y) - 1e-9 && p.y <= Math.max(a.y,b.y) + 1e-9;
  }
  function segmentsIntersect(a, b, c, d) {
    const o1=orientation(a,b,c), o2=orientation(a,b,d), o3=orientation(c,d,a), o4=orientation(c,d,b);
    if (o1*o2 < -1e-12 && o3*o4 < -1e-12) return true;
    if (Math.abs(o1)<1e-9 && onSegment(a,b,c)) return true;
    if (Math.abs(o2)<1e-9 && onSegment(a,b,d)) return true;
    if (Math.abs(o3)<1e-9 && onSegment(c,d,a)) return true;
    if (Math.abs(o4)<1e-9 && onSegment(c,d,b)) return true;
    return false;
  }
  function selfIntersects(points) {
    const n = points.length;
    if (n < 4) return false;
    for (let i=0; i<n; i++) {
      const a=points[i], b=points[(i+1)%n];
      if (distance2(a,b)<1e-12) return true;
      for (let j=i+1; j<n; j++) {
        if (j===i+1 || (i===0 && j===n-1)) continue;
        const c=points[j], d=points[(j+1)%n];
        if (segmentsIntersect(a,b,c,d)) return true;
      }
    }
    return false;
  }
  return {area, pointSegmentDistance, nearestSegment, simplifyFreehand, selfIntersects, copy};
});
