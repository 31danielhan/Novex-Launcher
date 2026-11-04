package dev.novex.client.mixin;

import com.mojang.authlib.GameProfile;
import dev.novex.client.SkinTexture;
import dev.novex.client.core.OfflineSkin;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.resources.ResourceLocation;
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
		if (!SkinTexture.isLocal(profile.getName())) return;
		ResourceLocation skin = SkinTexture.get();
		if (skin == null) return;
		PlayerSkin s = cir.getReturnValue();
		PlayerSkin.Model model = OfflineSkin.slim() ? PlayerSkin.Model.SLIM : PlayerSkin.Model.WIDE;
		cir.setReturnValue(new PlayerSkin(skin, null, s.capeTexture(), s.elytraTexture(), model, false));
	}
}
