package dev.novex.client.mixin;

import dev.novex.client.core.Stabilizer;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Camera stabilize: filters the local player's mouse turning before it's applied. */
@Mixin(Entity.class)
abstract class EntityTurnMixin {
	@ModifyVariable(method = "setAngles", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float novex$stabilizeYaw(float yaw) {
		return (Object) this instanceof EntityPlayerSP ? (float) Stabilizer.yaw(yaw) : yaw;
	}

	@ModifyVariable(method = "setAngles", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private float novex$stabilizePitch(float pitch) {
		return (Object) this instanceof EntityPlayerSP ? (float) Stabilizer.pitch(pitch) : pitch;
	}
}
