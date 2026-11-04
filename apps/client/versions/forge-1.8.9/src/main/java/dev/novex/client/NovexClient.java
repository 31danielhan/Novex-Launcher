package dev.novex.client;

import dev.novex.client.core.Clicks;
import dev.novex.client.core.Game;
import dev.novex.client.core.Gfx;
import dev.novex.client.core.Hud;
import dev.novex.client.core.Module;
import dev.novex.client.core.NovexCore;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiChat;
import net.minecraft.client.gui.GuiMainMenu;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.client.network.NetworkPlayerInfo;
import net.minecraft.client.renderer.EntityRenderer;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.RenderHelper;
import net.minecraft.client.resources.I18n;
import net.minecraft.client.settings.KeyBinding;
import net.minecraft.item.ItemStack;
import net.minecraft.potion.PotionEffect;
import net.minecraft.util.ResourceLocation;
import net.minecraftforge.client.event.FOVUpdateEvent;
import net.minecraftforge.client.event.GuiScreenEvent;
import net.minecraftforge.client.event.MouseEvent;
import net.minecraftforge.client.event.RenderGameOverlayEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.client.registry.ClientRegistry;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import org.lwjgl.input.Keyboard;
import org.lwjgl.opengl.GL11;

/** Minecraft 1.8.9 on Forge. Forge's events cover input, FOV and the HUD, so no mixins. */
@Mod(modid = "novex_client", name = "Novex Client", version = "0.1.0", clientSideOnly = true, acceptedMinecraftVersions = "[1.8.9]")
public final class NovexClient {
	private static final String CATEGORY = "Novex Client";
	static final KeyBinding menuKey = new KeyBinding("Open Novex Client menu", Keyboard.KEY_RSHIFT, CATEGORY);
	private static final KeyBinding zoomKey = new KeyBinding("Zoom", Keyboard.KEY_C, CATEGORY);
	private static boolean smoothBeforeZoom;
	/** 1.8.9 has no toggle-sprint option, so the client keeps the state itself. */
	private static boolean sprintToggled;
	private static boolean sprintWasDown;

	/** Motion blur level currently loaded, or 0 when it's off. */
	private static int blurLoaded;

	@Mod.EventHandler
	public void preInit(FMLPreInitializationEvent event) {
		NovexCore.init(event.getModConfigurationDirectory().toPath());
		NovexCore.modules = Module.values();
		ClientRegistry.registerKeyBinding(menuKey);
		ClientRegistry.registerKeyBinding(zoomKey);
		MinecraftForge.EVENT_BUS.register(this);
	}

	@SubscribeEvent
	public void onTick(TickEvent.ClientTickEvent e) {
		if (e.phase != TickEvent.Phase.END) return;
		Minecraft mc = Minecraft.getMinecraft();
		while (menuKey.isPressed()) mc.displayGuiScreen(new NovexScreen(mc.currentScreen, false));

		// Smooth camera while zoomed, like a spyglass; put the player's own choice back afterwards.
		boolean z = NovexCore.config.zoom && zoomKey.isKeyDown() && mc.currentScreen == null;
		if (z && !NovexCore.zooming) {
			smoothBeforeZoom = mc.gameSettings.smoothCamera;
			mc.gameSettings.smoothCamera = true;
		} else if (!z && NovexCore.zooming) {
			mc.gameSettings.smoothCamera = smoothBeforeZoom;
		}
		NovexCore.zooming = z;

		motionBlur(mc);

		// 1.7 block hit: holding attack while blocking swings the sword. This only starts the local
		// swing animation; nothing is sent to the server, so it doesn't change hits.
		EntityPlayerSP p = mc.thePlayer;
		if (NovexCore.config.oldBlockHit && p != null && mc.currentScreen == null && p.isUsingItem()
				&& mc.gameSettings.keyBindAttack.isKeyDown()
				&& (!p.isSwingInProgress || p.swingProgressInt >= 3 || p.swingProgressInt < 0)) {
			p.swingProgressInt = -1;
			p.isSwingInProgress = true;
		}

		KeyBinding sprint = mc.gameSettings.keyBindSprint;
		if (NovexCore.config.toggleSprint && mc.thePlayer != null) {
			boolean down = Keyboard.isCreated() && sprint.getKeyCode() > 0 && Keyboard.isKeyDown(sprint.getKeyCode());
			if (down && !sprintWasDown && mc.currentScreen == null) sprintToggled = !sprintToggled;
			sprintWasDown = down;
			if (sprintToggled) KeyBinding.setKeyBindState(sprint.getKeyCode(), true);
		} else if (sprintToggled) {
			sprintToggled = false;
			KeyBinding.setKeyBindState(sprint.getKeyCode(), false);
		}
	}

	/**
	 * Motion blur: Novex's camera motion blur shader (see MotionBlur). Reapplied if the game drops it
	 * (resizing, F5 spectating), and only removed if it's still ours.
	 */
	private static void motionBlur(Minecraft mc) {
		EntityRenderer r = mc.entityRenderer;
		int want = NovexCore.config.motionBlur && mc.theWorld != null ? NovexCore.config.motionBlurLevel : 0;
		boolean ours = r.isShaderActive() && r.getShaderGroup() != null
				&& r.getShaderGroup().getShaderGroupName().equals("novex_client:shaders/post/motion_blur.json");
		if (want > 0 && !ours) {
			// Leave other shaders (a spectated mob's view, super secret settings) alone.
			if (r.isShaderActive()) return;
			MotionTexture.register();
			r.loadShader(new ResourceLocation("novex_client", "shaders/post/motion_blur.json"));
			blurLoaded = want;
		} else if (want == 0 && blurLoaded != 0) {
			if (ours) r.stopUseShader();
			blurLoaded = 0;
		}
	}

	private static final int TITLE_BUTTON = 0x4e58;

	/** A Novex Client button on the title screen, above Singleplayer. */
	@SubscribeEvent
	public void onInitGui(GuiScreenEvent.InitGuiEvent.Post e) {
		if (e.gui instanceof GuiMainMenu && NovexCore.config.titleButton)
			e.buttonList.add(new GuiButton(TITLE_BUTTON, e.gui.width / 2 - 100, e.gui.height / 4 + 24, "Novex Client"));
	}

	@SubscribeEvent
	public void onButton(GuiScreenEvent.ActionPerformedEvent.Pre e) {
		if (e.gui instanceof GuiMainMenu && e.button.id == TITLE_BUTTON)
			Minecraft.getMinecraft().displayGuiScreen(new NovexScreen(e.gui, true));
	}

	/** The menu key opens the editor from any other screen too (menus, inventories, pause). */
	@SubscribeEvent
	public void onScreenKey(GuiScreenEvent.KeyboardInputEvent.Post e) {
		if (Keyboard.getEventKeyState() && Keyboard.getEventKey() == menuKey.getKeyCode()
				&& !(e.gui instanceof NovexScreen) && !(e.gui instanceof GuiChat))
			Minecraft.getMinecraft().displayGuiScreen(new NovexScreen(e.gui, false));
	}

	/** The blur shader needs this frame's camera turn, so update it every frame, not every tick. */
	@SubscribeEvent
	public void onRenderTick(TickEvent.RenderTickEvent e) {
		if (e.phase == TickEvent.Phase.START && blurLoaded != 0) MotionTexture.update();
	}

	@SubscribeEvent
	public void onMouse(MouseEvent e) {
		if (e.buttonstate && Minecraft.getMinecraft().currentScreen == null) Clicks.press(e.button);
	}

	@SubscribeEvent
	public void onFov(FOVUpdateEvent e) {
		// FOV effects off: no widening when sprinting or flying, no narrowing when drawing a bow.
		float fov = NovexCore.config.fovEffects ? e.newfov : 1f;
		e.newfov = NovexCore.zoomedFov(fov);
	}

	@SubscribeEvent
	public void onOverlay(RenderGameOverlayEvent.Post e) {
		if (e.type != RenderGameOverlayEvent.ElementType.ALL) return;
		Hud.draw(gfx(e.resolution), GAME);
		GlStateManager.color(1f, 1f, 1f, 1f);
	}

	static Gfx gfx() {
		return gfx(new ScaledResolution(Minecraft.getMinecraft()));
	}

	static Gfx gfx(final ScaledResolution res) {
		final Minecraft mc = Minecraft.getMinecraft();
		final FontRenderer font = mc.fontRendererObj;
		return new Gfx() {
			public int width() { return res.getScaledWidth(); }
			public int height() { return res.getScaledHeight(); }

			public void push(float x, float y, float scale) {
				GlStateManager.pushMatrix();
				GlStateManager.translate(x, y, 0);
				GlStateManager.scale(scale, scale, 1);
			}

			public void pop() { GlStateManager.popMatrix(); }

			public boolean icon(String id, int x, int y) {
				ItemStack stack = NovexClient.icon(id);
				if (stack != null) item(stack, x, y);
				return stack != null;
			}

			public void clip(int x1, int y1, int x2, int y2) {
				int f = res.getScaleFactor();
				GL11.glEnable(GL11.GL_SCISSOR_TEST);
				GL11.glScissor(x1 * f, mc.displayHeight - y2 * f, (x2 - x1) * f, (y2 - y1) * f);
			}

			public void noClip() { GL11.glDisable(GL11.GL_SCISSOR_TEST); }
			public void fill(int x1, int y1, int x2, int y2, int color) { Gui.drawRect(x1, y1, x2, y2, color); }
			public void text(String s, int x, int y, int color, boolean shadow) { font.drawString(s, x, y, color, shadow); }
			public int textWidth(String s) { return font.getStringWidth(s); }
			public int lineHeight() { return font.FONT_HEIGHT; }

			public void item(Object stack, int x, int y) {
				RenderHelper.enableGUIStandardItemLighting();
				mc.getRenderItem().renderItemAndEffectIntoGUI((ItemStack) stack, x, y);
				RenderHelper.disableStandardItemLighting();
			}
		};
	}


	private static final java.util.Map<String, ItemStack> ICONS = new java.util.HashMap<String, ItemStack>();

	/** Item stacks for module icons, by id; null when this version has no such item. */
	static ItemStack icon(String id) {
		if (!ICONS.containsKey(id)) {
			net.minecraft.item.Item item = net.minecraft.item.Item.getByNameOrId(id);
			ICONS.put(id, item == null ? null : new ItemStack(item));
		}
		return ICONS.get(id);
	}

	static final Game GAME = new Game() {
		private Minecraft mc() { return Minecraft.getMinecraft(); }

		public boolean active() { return mc().thePlayer != null && !mc().gameSettings.showDebugInfo; }
		public int fps() { return Minecraft.getDebugFPS(); }

		public int ping() {
			Minecraft mc = mc();
			if (mc.isSingleplayer() || mc.getNetHandler() == null) return -1;
			NetworkPlayerInfo info = mc.getNetHandler().getPlayerInfo(mc.thePlayer.getUniqueID());
			return info == null ? -1 : info.getResponseTime();
		}

		public double x() { return mc().thePlayer.posX; }
		public double y() { return mc().thePlayer.posY; }
		public double z() { return mc().thePlayer.posZ; }
		public String facing() { return mc().thePlayer.getHorizontalFacing().getName(); }

		public boolean down(Key key) {
			net.minecraft.client.settings.GameSettings o = mc().gameSettings;
			switch (key) {
				case UP: return o.keyBindForward.isKeyDown();
				case LEFT: return o.keyBindLeft.isKeyDown();
				case DOWN: return o.keyBindBack.isKeyDown();
				case RIGHT: return o.keyBindRight.isKeyDown();
				case JUMP: return o.keyBindJump.isKeyDown();
				case ATTACK: return o.keyBindAttack.isKeyDown();
				default: return o.keyBindUseItem.isKeyDown();
			}
		}

		public List<Piece> armor() {
			List<Piece> out = new ArrayList<Piece>();
			// getCurrentArmor counts from boots (0) to helmet (3).
			for (int i = 3; i >= 0; i--) add(out, mc().thePlayer.getCurrentArmor(i));
			add(out, mc().thePlayer.getHeldItem());
			return out;
		}

		private void add(List<Piece> out, ItemStack s) {
			if (s != null)
				out.add(Hud.piece(s, s.isItemStackDamageable(), s.getMaxDamage(), s.getItemDamage(), s.stackSize));
		}

		public List<Effect> effects() {
			List<Effect> out = new ArrayList<Effect>();
			for (PotionEffect e : mc().thePlayer.getActivePotionEffects())
				out.add(new Effect(I18n.format(e.getEffectName()), e.getAmplifier(), e.getDuration(), e.getIsPotionDurationMax()));
			return out;
		}

		public int blocksToBuildLimit() {
			return Math.max(0, NovexCore.config.buildHeight - (int) Math.floor(mc().thePlayer.posY));
		}
	};
}
