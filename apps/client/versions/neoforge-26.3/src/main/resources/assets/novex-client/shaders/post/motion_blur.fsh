#version 330
#extension GL_ARB_separate_shader_objects : require

// Novex Client camera motion blur. The motion texture holds this frame's camera turn (see MotionBlur.java);
// each pixel averages samples along the path its point moved across the screen during the turn.

uniform sampler2D InSampler;
uniform sampler2D MotionSampler;

layout(location = 0) in vec2 texCoord;
layout(location = 0) out vec4 fragColor;

float dec(int i) {
    float hi = texelFetch(MotionSampler, ivec2(2 * i, 0), 0).r;
    float lo = texelFetch(MotionSampler, ivec2(2 * i + 1, 0), 0).r;
    return (floor(hi * 255.0 + 0.5) * 256.0 + floor(lo * 255.0 + 0.5)) / 65535.0 * 2.0 - 1.0;
}

void main() {
    float yaw = dec(0) * 0.6;
    float pitch = dec(1) * 0.6;
    float tanHalf = (dec(2) + 1.0) * 2.0;
    float aspect = (dec(3) + 1.0) * 2.0;
    float strength = dec(4) + 1.0;

    // Where this pixel's point was before the turn: rotate its view direction back, then project.
    vec2 ndc = texCoord * 2.0 - 1.0;
    vec3 dir = vec3(ndc.x * tanHalf * aspect, ndc.y * tanHalf, -1.0);
    float cy = cos(yaw), sy = sin(yaw);
    dir = vec3(cy * dir.x + sy * dir.z, dir.y, -sy * dir.x + cy * dir.z);
    float cp = cos(pitch), sp = sin(pitch);
    dir = vec3(dir.x, cp * dir.y - sp * dir.z, sp * dir.y + cp * dir.z);
    vec2 prev = dir.xy / max(0.001, -dir.z) / vec2(tanHalf * aspect, tanHalf);

    vec2 velocity = (ndc - prev) * 0.5 * strength;
    float len = length(velocity);
    if (len > 0.2) velocity *= 0.2 / len;
    vec3 color = texture(InSampler, texCoord).rgb;
    if (len > 0.0005) {
        // 16 samples centered on the pixel, offset by a per-pixel jitter so steps don't show.
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        color = vec3(0.0);
        for (int i = 0; i < 16; i++) {
            float t = (float(i) + jitter) / 16.0 - 0.5;
            color += texture(InSampler, texCoord + velocity * t).rgb;
        }
        color /= 16.0;
    }
    fragColor = vec4(color, 1.0);
}
