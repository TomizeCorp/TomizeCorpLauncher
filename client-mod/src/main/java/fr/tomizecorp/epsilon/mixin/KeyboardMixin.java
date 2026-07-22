package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.WaypointScreen;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Keyboard.class)
public abstract class KeyboardMixin {
    @Inject(method = "onKey", at = @At("TAIL"))
    private void tomize$openWaypoints(long window, int action, KeyInput input, CallbackInfo ci) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (action == GLFW.GLFW_PRESS && input.key() == GLFW.GLFW_KEY_B && client.currentScreen == null && client.player != null) {
            client.setScreen(new WaypointScreen());
        }
    }
}
