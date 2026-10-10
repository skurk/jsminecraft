const EPSILON = 1e-3;
export function moveBody(world, body, dt) {
    body.onGround = false;
    moveAxis(world, body, 'x', body.velocity.x * dt);
    moveAxis(world, body, 'z', body.velocity.z * dt);
    moveAxis(world, body, 'y', body.velocity.y * dt);
}
/** Pushes a body out of the upright cylinder of every living entity it overlaps. */
export function pushOutOfEntities(world, body, entities) {
    for (const entity of entities) {
        if (entity.dead)
            continue;
        const other = entity.position;
        if (body.position.y + body.height <= other.y || other.y + entity.height <= body.position.y)
            continue;
        let dx = body.position.x - other.x;
        let dz = body.position.z - other.z;
        let distance = Math.hypot(dx, dz);
        const minDistance = body.radius + entity.radius;
        if (distance >= minDistance)
            continue;
        // Exactly concentric: any direction will do, so shove along +X.
        if (distance < EPSILON) {
            dx = 1;
            dz = 0;
            distance = 1;
        }
        const nx = dx / distance;
        const nz = dz / distance;
        const overlap = minDistance - distance + EPSILON;
        // Routed through the voxel solver so the push cannot shove the body into a wall.
        moveAxis(world, body, 'x', nx * overlap);
        moveAxis(world, body, 'z', nz * overlap);
        const into = body.velocity.x * nx + body.velocity.z * nz;
        if (into < 0) {
            body.velocity.x -= nx * into;
            body.velocity.z -= nz * into;
        }
    }
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
