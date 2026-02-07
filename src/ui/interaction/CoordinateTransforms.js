/**
 * 将画布坐标转换为元器件局部坐标（考虑旋转）
 */
export function canvasToComponentLocal(comp, canvasPoint) {
    const dx = canvasPoint.x - (comp.x || 0);
    const dy = canvasPoint.y - (comp.y || 0);
    const rotation = (comp.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos
    };
}
