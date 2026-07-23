package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import java.util.Map;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.CookieStorage;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin extends Screen {
    protected TitleScreenMixin(Text title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"))
    private void epsilon$lockMenu(CallbackInfo ci) {
        clearChildren();
        int left = width / 2 - 100;
        int top = height / 2 + 4;
        addDrawableChild(ButtonWidget.builder(Text.literal("Lancer Epsilon"), button -> epsilon$connect()).dimensions(left, top, 200, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Option"), button -> {
            MinecraftClient client = MinecraftClient.getInstance();
            client.setScreen(new OptionsScreen(this, client.options));
        }).dimensions(left, top + 28, 200, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Quitter"), button -> MinecraftClient.getInstance().scheduleStop()).dimensions(left, top + 56, 200, 20).build());
    }

    @Inject(method = "render", at = @At("TAIL"))
    private void epsilon$renderBranding(DrawContext context, int mouseX, int mouseY, float deltaTicks, CallbackInfo ci) {
        MinecraftClient client = MinecraftClient.getInstance();
        int center = width / 2;

        // Masque la mention Java Edition et la remplace par l'identité EPSILON.
        context.fill(center - 92, 76, center + 92, 100, 0xD80D1710);
        context.fill(center - 88, 80, center + 88, 96, 0xFF18291B);
        context.fill(center - 88, 80, center + 88, 82, 0xFF9B7A43);
        context.drawCenteredTextWithShadow(client.textRenderer, Text.literal("EPSILON EDITION"), center, 85, 0xFFE7D8B0);

        // Retire la ligne technique Minecraft/Fabric affichée en bas à gauche.
        context.fill(0, height - 14, Math.min(310, width), height, 0xE6080D09);
    }

    private void epsilon$connect() {
        MinecraftClient client = MinecraftClient.getInstance();
        ServerAddress address = ServerAddress.parse(EpsilonBranding.SERVER);
        ServerInfo info = new ServerInfo("EPSILON", EpsilonBranding.SERVER, ServerInfo.ServerType.OTHER);
        ConnectScreen.connect(this, client, address, info, true, new CookieStorage(Map.of(), Map.of(), false));
    }
}
