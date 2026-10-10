// 座位沿橢圓排列，index 0 = 自己，固定在正下方，其餘順時針排列。
// 所有座標皆為牌桌容器的百分比。
export function getTableLayout(count, portrait) {
  const rx = portrait ? 38 : 44;
  const ry = portrait ? 42 : 41;
  // 下注籌碼位置：從座位往桌心內縮
  const bx = portrait ? 0.66 : 0.6;
  const by = portrait ? 0.6 : 0.58;

  const seats = Array.from({ length: count }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / count;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      seat: { x: 50 + rx * cos, y: 50 + ry * sin },
      bet: { x: 50 + rx * bx * cos, y: 50 + ry * by * sin },
    };
  });

  return {
    seats,
    pot: { x: 50, y: portrait ? 36 : 35 },
    board: { x: 50, y: portrait ? 45 : 50 },
    banner: { x: 50, y: portrait ? 55 : 64 },
  };
}
