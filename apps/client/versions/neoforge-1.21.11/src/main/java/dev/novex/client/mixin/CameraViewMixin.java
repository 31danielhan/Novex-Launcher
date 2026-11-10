package dev.novex.client.mixin;

import dev.novex.client.core.Stabilizer;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Camera stabilize on servers: steadies what's drawn only. The player's real rotation and aim are untouched. */
@Mixin(Camera.class)
abstract class CameraViewMixin {
	@ModifyVariable(method = "setRotation(FF)V", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float novex$stabilizeYaw(float yaw) {
		return novex$onServer() ? Stabilizer.viewYaw(yaw) : yaw;
	}

	@ModifyVariable(method = "setRotation(FF)V", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private float novex$stabilizePitch(float pitch) {
		return novex$onServer() ? Stabilizer.viewPitch(pitch) : pitch;
	}

	private static boolean novex$onServer() {
		Minecraft mc = Minecraft.getInstance();
		return !mc.hasSingleplayerServer() && mc.options.getCameraType().isFirstPerson()
				&& mc.player != null && mc.getCameraEntity() == mc.player;
	}
}
