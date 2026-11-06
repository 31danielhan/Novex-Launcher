#version 120

// Novex Client camera motion blur. The motion texture holds this frame's camera turn (see MotionBlur.java);
// each pixel averages samples along the path its point moved across the screen during the turn.

uniform sampler2D DiffuseSampler;
uniform sampler2D MotionSampler;
uniform sampler2D HistorySampler;

varying vec2 texCoord;

float dec(int i) {
    float hi = texture2D(MotionSampler, vec2((float(2 * i) + 0.5) / 14.0, 0.5)).r;
    float lo = texture2D(MotionSampler, vec2((float(2 * i + 1) + 0.5) / 14.0, 0.5)).r;
    return (floor(hi * 255.0 + 0.5) * 256.0 + floor(lo * 255.0 + 0.5)) / 65535.0 * 2.0 - 1.0;
}

void main() {
    float yaw = dec(0) * 0.6;
    float pitch = dec(1) * 0.6;
    float walk = (dec(4) + 1.0) * 0.012;
    vec3 color = texture2D(DiffuseSampler, texCoord).rgb;

    // Nothing to read or sample further while the view and player are still.
    if (abs(yaw) + abs(pitch) + walk > 0.0002) {
        vec2 ndc = texCoord * 2.0 - 1.0;
        // Walking: everything streaks away from the middle of the screen.
        vec2 velocity = ndc * walk;
        if (abs(yaw) + abs(pitch) > 0.0002) {
            // Where this pixel's point was before the turn: rotate its view direction back, then project.
            float tanHalf = (dec(2) + 1.0) * 2.0;
            float aspect = (dec(3) + 1.0) * 2.0;
            vec3 dir = vec3(ndc.x * tanHalf * aspect, ndc.y * tanHalf, -1.0);
            float cy = cos(yaw), sy = sin(yaw);
            dir = vec3(cy * dir.x + sy * dir.z, dir.y, -sy * dir.x + cy * dir.z);
            float cp = cos(pitch), sp = sin(pitch);
            dir = vec3(dir.x, cp * dir.y - sp * dir.z, sp * dir.y + cp * dir.z);
            vec2 prev = dir.xy / max(0.001, -dir.z) / vec2(tanHalf * aspect, tanHalf);
            velocity += (ndc - prev) * 0.5;
        }
        float len = length(velocity);
        if (len > 0.2) velocity *= 0.2 / len;
        if (len > 0.0005) {
            // Only as many samples as the streak's length needs. A per-pixel jitter hides the steps, and
            // samples near the ends count for less, so the blur fades out instead of ending at an edge.
            int count = int(clamp(len * 160.0 + 8.0, 8.0, 24.0));
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            vec3 sum = vec3(0.0);
            float total = 0.0;
            for (int i = 0; i < count; i++) {
                float t = (float(i) + jitter) / float(count) - 0.5;
                float weight = 1.0 - abs(t) * 1.5;
                sum += texture2D(DiffuseSampler, texCoord + velocity * t).rgb * weight;
                total += weight;
            }
            color = sum / total;
        }
    }
    // A little of the last frame, for motion the camera can't describe. The lower screen, where the
    // hand and held item are, keeps more so swings blur.
    float keep = (dec(5) + 1.0) * 0.5;
    float hand = smoothstep(0.75, 0.25, texCoord.y);
    keep = mix(keep, sqrt(keep), hand) * 0.6;
    // More while hitting, breaking or using an item.
    keep = max(keep, hand * (dec(6) + 1.0) * 0.5);
    color = mix(color, texture2D(HistorySampler, texCoord).rgb, keep);
    gl_FragColor = vec4(color, 1.0);
}
