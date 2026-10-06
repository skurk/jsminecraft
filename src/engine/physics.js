const EPSILON = 1e-3;
export function moveBody(world, body, dt) {
    body.onGround = false;
    moveAxis(world, body, 'x', body.velocity.x * dt);
    moveAxis(world, body, 'z', body.velocity.z * dt);
    moveAxis(world, body, 'y', body.velocity.y * dt);
}
/** Moves along a single axis and resolves the first blocking voxel it meets. */
function moveAxis(world, body, axis, amount) {
    if (amount === 0)
        return;
    body.position[axis] += amount;
    const p = body.position;
    const r = body.radius;
    const minX = Math.floor(p.x - r);
    const maxX = Math.floor(p.x + r);
    const minY = Math.floor(p.y);
    const maxY = Math.floor(p.y + body.height - EPSILON);
    const minZ = Math.floor(p.z - r);
    const maxZ = Math.floor(p.z + r);
    for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let x = minX; x <= maxX; x++) {
                if (!world.isSolidAt(x, y, z))
                    continue;
                if (axis === 'x') {
                    p.x = amount > 0 ? x - r - EPSILON : x + 1 + r + EPSILON;
                    body.velocity.x = 0;
                }
                else if (axis === 'z') {
                    p.z = amount > 0 ? z - r - EPSILON : z + 1 + r + EPSILON;
                    body.velocity.z = 0;
                }
                else if (amount > 0) {
                    p.y = y - body.height - EPSILON;
                    body.velocity.y = 0;
                }
                else {
                    p.y = y + 1 + EPSILON;
                    body.velocity.y = 0;
                    body.onGround = true;
                }
                return;
            }
        }
    }
}
