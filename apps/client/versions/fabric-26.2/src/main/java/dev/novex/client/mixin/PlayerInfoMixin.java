package dev.novex.client.mixin;

import com.mojang.authlib.GameProfile;
import dev.novex.client.SkinTexture;
import dev.novex.client.core.OfflineSkin;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Puts the launcher's skin on an offline player's own character, in every place it's drawn. */
@Mixin(PlayerInfo.class)
abstract class PlayerInfoMixin {
	@Shadow @Final private GameProfile profile;

	@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
	private void novex$skin(CallbackInfoReturnable<PlayerSkin> cir) {
		if (!SkinTexture.isLocal(profile.name())) return;
		Identifier skin = SkinTexture.get();
		if (skin == null) return;
		PlayerSkin s = cir.getReturnValue();
		PlayerModelType model = OfflineSkin.slim() ? PlayerModelType.SLIM : PlayerModelType.WIDE;
		cir.setReturnValue(PlayerSkin.insecure(new ClientAsset.ResourceTexture(skin, skin), s.cape(), s.elytra(), model));
	}
}
