package dev.novex.client.mixin;

import dev.novex.client.core.Stabilizer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Camera stabilize: filters the local player's mouse turning before it's applied. */
@Mixin(Entity.class)
abstract class EntityTurnMixin {
	@ModifyVariable(method = "turn", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private double novex$stabilizeYaw(double yaw) {
		return novex$singleplayer() ? Stabilizer.yaw(yaw) : yaw;
	}

	@ModifyVariable(method = "turn", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private double novex$stabilizePitch(double pitch) {
		return novex$singleplayer() ? Stabilizer.pitch(pitch) : pitch;
	}

	/** Never in multiplayer: a server must only ever see the mouse's real movement. */
	private boolean novex$singleplayer() {
		return (Object) this instanceof LocalPlayer && Minecraft.getInstance().hasSingleplayerServer();
	}
}
