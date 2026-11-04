import org.apache.commons.lang3.SystemUtils

// Minecraft 1.8.9 needs the legacy Forge toolchain (Essential's Loom fork, Gradle 8.8, Java 8),
// so this target has its own Gradle wrapper instead of the shared one.
plugins {
	java
	id("gg.essential.loom") version "0.10.0.+"
	id("dev.architectury.architectury-pack200") version "0.1.3"
	id("com.github.johnrengelman.shadow") version "8.1.1"
}

java {
	toolchain.languageVersion.set(JavaLanguageVersion.of(8))
}

// HUD logic shared by every version lives in ../../core.
sourceSets.main {
	java.srcDir("../../core/src")
	output.setResourcesDir(sourceSets.main.flatMap { it.java.classesDirectory })
}

loom {
	launchConfigs {
		"client" {
			arg("--tweakClass", "org.spongepowered.asm.launch.MixinTweaker")
		}
	}
	runConfigs {
		"client" {
			// This argument crashes 1.8.9 on macOS.
			if (SystemUtils.IS_OS_MAC_OSX) vmArgs.remove("-XstartOnFirstThread")
		}
		remove(getByName("server"))
	}
	forge {
		pack200Provider.set(dev.architectury.pack200.java.Pack200Adapter())
		mixinConfig("mixins.novex_client.json")
	}
	mixin {
		defaultRefmapName.set("mixins.novex_client.refmap.json")
	}
}

repositories {
	mavenCentral()
	maven("https://repo.spongepowered.org/maven/")
}

// Forge 1.8.9 has no Mixin, so the jar carries it (shaded) and loads it through MixinTweaker.
val shadowImpl: Configuration by configurations.creating {
	configurations.implementation.get().extendsFrom(this)
}

dependencies {
	minecraft("com.mojang:minecraft:1.8.9")
	mappings("de.oceanlabs.mcp:mcp_stable:22-1.8.9")
	forge("net.minecraftforge:forge:1.8.9-11.15.1.2318-1.8.9")
	shadowImpl("org.spongepowered:mixin:0.7.11-SNAPSHOT") {
		isTransitive = false
	}
	annotationProcessor("org.spongepowered:mixin:0.8.5-SNAPSHOT")
}

tasks.withType(JavaCompile::class) {
	options.encoding = "UTF-8"
}

tasks.withType(org.gradle.jvm.tasks.Jar::class) {
	archiveBaseName.set("novex-client-forge-1.8.9")
	manifest.attributes.run {
		this["FMLCorePluginContainsFMLMod"] = "true"
		this["ForceLoadAsMod"] = "true"
		this["TweakClass"] = "org.spongepowered.asm.launch.MixinTweaker"
		this["MixinConfigs"] = "mixins.novex_client.json"
	}
}

// Release jar: classes plus shaded Mixin, remapped to the names the game uses at runtime.
val remapJar by tasks.named<net.fabricmc.loom.task.RemapJarTask>("remapJar") {
	archiveClassifier.set("")
	from(tasks.shadowJar)
	input.set(tasks.shadowJar.get().archiveFile)
}

tasks.jar {
	archiveClassifier.set("without-deps")
	destinationDirectory.set(layout.buildDirectory.dir("intermediates"))
}

tasks.shadowJar {
	destinationDirectory.set(layout.buildDirectory.dir("intermediates"))
	archiveClassifier.set("non-obfuscated-with-deps")
	configurations = listOf(shadowImpl)
}

tasks.assemble.get().dependsOn(tasks.remapJar)

tasks.processResources {
	inputs.property("version", project.version)
	filesMatching("mcmod.info") {
		expand(inputs.properties)
	}
}
