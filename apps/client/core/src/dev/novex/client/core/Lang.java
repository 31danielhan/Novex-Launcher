package dev.novex.client.core;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Translations for Novex's own menus and HUD, in the language Minecraft is set to. The language is
 * read from options.txt in the game folder (the working directory), so changing it in Minecraft's
 * Language screen switches Novex too. Text without a translation stays in English.
 *
 * Columns match the launcher: English, 中文, Español, Français, Deutsch, Português, Русский, 日本語, 한국어.
 * {name} placeholders are filled by {@link #tr(String, Object...)}.
 */
public final class Lang {
	private static final String[] CODES = {"en", "zh", "es", "fr", "de", "pt", "ru", "ja", "ko"};
	private static final Map<String, String[]> ROWS = new HashMap<String, String[]>();

	private static int current;
	private static long checked, modified = -1;

	private Lang() {}

	/** {@code en} in the current language, with {name} placeholders filled from name/value pairs. */
	public static String tr(String en, Object... pairs) {
		refresh();
		String[] row = current == 0 ? null : ROWS.get(en);
		String s = row != null && row[current] != null ? row[current] : en;
		for (int i = 0; i + 1 < pairs.length; i += 2) s = s.replace("{" + pairs[i] + "}", String.valueOf(pairs[i + 1]));
		return s;
	}

	/** Re-reads the language once a second, when options.txt has changed. */
	private static void refresh() {
		long now = System.currentTimeMillis();
		if (now - checked < 1000) return;
		checked = now;
		File file = new File("options.txt");
		long m = file.lastModified();
		if (m == modified) return;
		modified = m;
		current = 0;
		if (m == 0) return;
		try {
			BufferedReader in = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8));
			try {
				for (String line; (line = in.readLine()) != null;) {
					if (!line.startsWith("lang:")) continue;
					String code = line.substring(5).trim().toLowerCase(java.util.Locale.ROOT);
					for (int i = 1; i < CODES.length; i++) if (code.startsWith(CODES[i] + "_")) current = i;
					break;
				}
			} finally {
				in.close();
			}
		} catch (Exception e) {
			current = 0;
		}
	}

	private static void add(String... row) {
		ROWS.put(row[0], row);
	}

	static {
		// Title screen
		add("Singleplayer", "单人游戏", "Un jugador", "Solo", "Einzelspieler", "Um jogador", "Одиночная игра", "シングルプレイ", "싱글플레이");
		add("Multiplayer", "多人游戏", "Multijugador", "Multijoueur", "Mehrspieler", "Multijogador", "Сетевая игра", "マルチプレイ", "멀티플레이");
		add("Novex Client", "Novex 客户端", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex クライアント", "Novex 클라이언트");
		add("Options", "选项", "Opciones", "Options", "Optionen", "Opções", "Настройки", "設定", "설정");
		add("Quit Game", "退出游戏", "Salir del juego", "Quitter le jeu", "Spiel beenden", "Sair do jogo", "Выйти из игры", "ゲーム終了", "게임 종료");
		// Menu
		add("Settings", "设置", "Ajustes", "Réglages", "Einstellungen", "Configurações", "Настройки", "設定", "설정");
		add("Modules", "模块", "Módulos", "Modules", "Module", "Módulos", "Модули", "モジュール", "모듈");
		add("Edit HUD", "编辑 HUD", "Editar HUD", "Modifier le HUD", "HUD bearbeiten", "Editar HUD", "Изменить HUD", "HUD を編集", "HUD 편집");
		add("Search modules...", "搜索模块…", "Buscar módulos...", "Rechercher des modules...", "Module suchen ...", "Buscar módulos...", "Поиск модулей...", "モジュールを検索…", "모듈 검색...");
		add("No modules match \"{query}\"", "没有匹配“{query}”的模块", "Ningún módulo coincide con \"{query}\"", "Aucun module ne correspond à « {query} »", "Keine Module für „{query}“", "Nenhum módulo corresponde a \"{query}\"", "Нет модулей по запросу «{query}»", "「{query}」に一致するモジュールはありません", "\"{query}\"와 일치하는 모듈이 없습니다");
		add("Right Shift", "右 Shift", "Mayús der.", "Maj droite", "Rechte Umschalttaste", "Shift dir.", "Правый Shift", "右 Shift", "오른쪽 Shift");
		add("All", "全部", "Todos", "Tous", "Alle", "Todos", "Все", "すべて", "전체");
		add("HUD", "HUD", "HUD", "HUD", "HUD", "HUD", "HUD", "HUD", "HUD");
		add("Visual", "视觉", "Visual", "Visuel", "Optik", "Visual", "Визуал", "見た目", "시각");
		add("Gameplay", "玩法", "Jugabilidad", "Jouabilité", "Spielmechanik", "Jogabilidade", "Игровой процесс", "ゲームプレイ", "게임플레이");
		add("Enabled", "启用", "Activado", "Activé", "Aktiviert", "Ativado", "Включено", "有効", "사용");
		add("Zoom strength", "缩放强度", "Intensidad del zoom", "Force du zoom", "Zoomstärke", "Força do zoom", "Сила зума", "ズームの強さ", "확대 강도");
		add("Strength", "强度", "Intensidad", "Intensité", "Stärke", "Intensidade", "Сила", "強さ", "강도");
		add("Style", "样式", "Estilo", "Style", "Stil", "Estilo", "Стиль", "スタイル", "스타일");
		add("Ripping", "撕咬", "Desgarrar", "Arrachage", "Reißen", "Rasgar", "Рывками", "かじる", "뜯기");
		add("Smooth", "平滑", "Suave", "Fluide", "Weich", "Suave", "Плавно", "なめらか", "부드럽게");
		add("Score numbers", "分数数字", "Números de puntuación", "Chiffres du score", "Punktzahlen", "Números da pontuação", "Числа счёта", "スコアの数字", "점수 숫자");
		add("Build height", "建筑高度", "Altura de construcción", "Hauteur de construction", "Bauhöhe", "Altura de construção", "Высота строительства", "建築高度", "건축 높이");
		add("Size", "大小", "Tamaño", "Taille", "Größe", "Tamanho", "Размер", "サイズ", "크기");
		add("Position", "位置", "Posición", "Position", "Position", "Posição", "Положение", "位置", "위치");
		add("Reset", "重置", "Restablecer", "Réinitialiser", "Zurücksetzen", "Redefinir", "Сбросить", "リセット", "초기화");
		add("Custom home page", "自定义主页", "Página de inicio propia", "Page d'accueil personnalisée", "Eigene Startseite", "Página inicial personalizada", "Своя главная страница", "カスタムホーム画面", "사용자 지정 홈 화면");
		add("Title screen button", "标题界面按钮", "Botón en la pantalla de título", "Bouton sur l'écran titre", "Titelbildschirm-Taste", "Botão na tela de título", "Кнопка на главном экране", "タイトル画面のボタン", "타이틀 화면 버튼");
		add("HUD layout", "HUD 布局", "Diseño del HUD", "Disposition du HUD", "HUD-Layout", "Layout do HUD", "Расположение HUD", "HUD のレイアウト", "HUD 배치");
		add("Menu key", "菜单键", "Tecla del menú", "Touche du menu", "Menütaste", "Tecla do menu", "Клавиша меню", "メニューキー", "메뉴 키");
		add("Right Shift (change in Controls)", "右 Shift（在“按键控制”中更改）", "Mayús der. (cámbiala en Controles)", "Maj droite (à changer dans Commandes)", "Rechte Umschalttaste (in Steuerung änderbar)", "Shift dir. (mude em Controles)", "Правый Shift (меняется в «Управлении»)", "右 Shift（操作設定で変更）", "오른쪽 Shift (조작에서 변경)");
		add("Novex Client shows information only: no reach, hitbox, auto-click or ESP.", "Novex Client 只显示信息：没有攻击距离、碰撞箱、自动点击或透视。", "Novex Client solo muestra información: sin alcance, hitbox, autoclic ni ESP.", "Novex Client n'affiche que des informations : pas de portée, hitbox, autoclic ni ESP.", "Novex Client zeigt nur Informationen: kein Reach, Hitbox, Autoklick oder ESP.", "O Novex Client só mostra informações: sem alcance, hitbox, autoclique ou ESP.", "Novex Client только показывает информацию: без увеличения дальности, хитбоксов, автокликера и ESP.", "Novex Client は情報を表示するだけです。リーチ、ヒットボックス、オートクリック、ESP はありません。", "Novex Client는 정보만 보여 줍니다. 리치, 히트박스, 자동 클릭, ESP는 없습니다.");
		add("Drag to move. Drag a corner or scroll to resize. Esc to go back.", "拖动来移动。拖动角落或滚动来调整大小。按 Esc 返回。", "Arrastra para mover. Arrastra una esquina o usa la rueda para cambiar el tamaño. Esc para volver.", "Glissez pour déplacer. Glissez un coin ou faites défiler pour redimensionner. Échap pour revenir.", "Ziehen zum Verschieben. Ecke ziehen oder scrollen zum Skalieren. Esc für zurück.", "Arraste para mover. Arraste um canto ou role para redimensionar. Esc para voltar.", "Перетащите, чтобы переместить. Тяните за угол или крутите колесо, чтобы изменить размер. Esc — назад.", "ドラッグで移動。角をドラッグするかスクロールで大きさを変更。Esc で戻ります。", "드래그해서 이동하세요. 모서리를 드래그하거나 스크롤하면 크기가 바뀝니다. Esc로 돌아갑니다.");
		// Now playing
		add("Needs macOS", "需要 macOS", "Requiere macOS", "Nécessite macOS", "Benötigt macOS", "Requer macOS", "Нужна macOS", "macOS が必要です", "macOS 필요");
		add("Nothing playing", "没有正在播放的内容", "No se reproduce nada", "Rien en lecture", "Nichts wird abgespielt", "Nada tocando", "Ничего не играет", "再生中のものはありません", "재생 중인 항목 없음");
		add("Start music or a video in any app.", "在任意应用中播放音乐或视频。", "Pon música o un vídeo en cualquier app.", "Lancez de la musique ou une vidéo dans n'importe quelle app.", "Starte Musik oder ein Video in einer beliebigen App.", "Toque música ou um vídeo em qualquer app.", "Включите музыку или видео в любом приложении.", "どのアプリでも音楽や動画を再生してください。", "아무 앱에서나 음악이나 동영상을 재생하세요.");
		add("Play something in any app", "在任意应用中播放内容", "Reproduce algo en cualquier app", "Lancez quelque chose dans une app", "Spiel etwas in einer App ab", "Toque algo em qualquer app", "Включите что-нибудь в любом приложении", "どのアプリでも再生してください", "아무 앱에서나 재생하세요");
		add("Playing in {app}", "正在 {app} 中播放", "Sonando en {app}", "Lecture dans {app}", "Läuft in {app}", "Tocando no {app}", "Играет в {app}", "{app} で再生中", "{app}에서 재생 중");
		// HUD
		add("Zoom {n}x", "缩放 {n}x", "Zoom {n}x", "Zoom {n}x", "Zoom {n}x", "Zoom {n}x", "Зум {n}x", "ズーム {n}x", "확대 {n}x");
		add("Build limit reached", "已到达建筑高度上限", "Límite de construcción alcanzado", "Limite de construction atteinte", "Bauhöhe erreicht", "Limite de construção atingido", "Достигнут предел высоты", "建築上限に到達", "건축 한도 도달");
		add("1 block to build limit", "距建筑上限 1 格", "1 bloque hasta el límite", "1 bloc avant la limite", "1 Block bis zur Bauhöhe", "1 bloco até o limite", "1 блок до предела", "建築上限まで 1 ブロック", "건축 한도까지 1블록");
		add("{n} blocks to build limit", "距建筑上限 {n} 格", "{n} bloques hasta el límite", "{n} blocs avant la limite", "{n} Blöcke bis zur Bauhöhe", "{n} blocos até o limite", "{n} блоков до предела", "建築上限まで {n} ブロック", "건축 한도까지 {n}블록");
		add("Facing {dir}", "朝向 {dir}", "Mirando al {dir}", "Face au {dir}", "Blick nach {dir}", "Virado para {dir}", "Смотрит на {dir}", "向き：{dir}", "방향: {dir}");
		add("north", "北", "norte", "nord", "Norden", "norte", "север", "北", "북");
		add("south", "南", "sur", "sud", "Süden", "sul", "юг", "南", "남");
		add("east", "东", "este", "est", "Osten", "leste", "восток", "東", "동");
		add("west", "西", "oeste", "ouest", "Westen", "oeste", "запад", "西", "서");
		add("Jump", "跳跃", "Saltar", "Saut", "Springen", "Pular", "Прыжок", "ジャンプ", "점프");
		// Modules
		add("FPS", "FPS", "FPS", "IPS", "FPS", "FPS", "FPS", "FPS", "FPS");
		add("CPS", "CPS", "CPS", "CPS", "CPS", "CPS", "CPS", "CPS", "CPS");
		add("Ping", "延迟", "Ping", "Ping", "Ping", "Ping", "Пинг", "Ping", "핑");
		add("Coordinates", "坐标", "Coordenadas", "Coordonnées", "Koordinaten", "Coordenadas", "Координаты", "座標", "좌표");
		add("Keystrokes", "按键显示", "Teclas", "Touches", "Tastenanzeige", "Teclas", "Нажатия клавиш", "キー表示", "키 입력 표시");
		add("Armor status", "盔甲状态", "Estado de la armadura", "État de l'armure", "Rüstungsstatus", "Status da armadura", "Состояние брони", "防具の状態", "갑옷 상태");
		add("Potion effects", "药水效果", "Efectos de pociones", "Effets de potion", "Trankeffekte", "Efeitos de poção", "Эффекты зелий", "ポーション効果", "물약 효과");
		add("Toggle sprint", "切换疾跑", "Correr fijo", "Sprint permanent", "Dauersprint", "Corrida fixa", "Переключение бега", "ダッシュ切替", "달리기 전환");
		add("Zoom", "缩放", "Zoom", "Zoom", "Zoom", "Zoom", "Зум", "ズーム", "확대");
		add("Motion blur", "动态模糊", "Desenfoque de movimiento", "Flou de mouvement", "Bewegungsunschärfe", "Desfoque de movimento", "Размытие движения", "モーションブラー", "모션 블러");
		add("Camera stabilize", "镜头防抖", "Estabilizar cámara", "Stabilisation de la caméra", "Kamera stabilisieren", "Estabilizar câmera", "Стабилизация камеры", "カメラ補正", "카메라 안정화");
		add("Fullbright", "夜视亮度", "Brillo total", "Pleine luminosité", "Volle Helligkeit", "Brilho total", "Полная яркость", "明るさ最大", "최대 밝기");
		add("Custom sky", "自定义天空", "Cielo personalizado", "Ciel personnalisé", "Eigener Himmel", "Céu personalizado", "Своё небо", "カスタムスカイ", "사용자 지정 하늘");
		add("1.7 block hit", "1.7 格挡攻击", "Golpe con bloqueo 1.7", "Coup en parade 1.7", "1.7-Blockhit", "Golpe com bloqueio 1.7", "Удар с блоком 1.7", "1.7 ブロックヒット", "1.7 막기 공격");
		add("1.7 eating", "1.7 进食", "Comer como en 1.7", "Manger comme en 1.7", "1.7-Essen", "Comer como no 1.7", "Еда как в 1.7", "1.7 の食事", "1.7 먹기");
		add("Smooth sneak", "平滑潜行", "Agacharse suave", "Accroupissement fluide", "Weiches Schleichen", "Agachar suave", "Плавное приседание", "なめらかスニーク", "부드러운 웅크리기");
		add("Eating animation", "进食动画", "Animación al comer", "Animation de repas", "Essanimation", "Animação de comer", "Анимация еды", "食事アニメーション", "먹기 애니메이션");
		add("Damage tilt", "受伤倾斜", "Inclinación por daño", "Inclinaison des dégâts", "Schadensneigung", "Inclinação por dano", "Наклон при уроне", "ダメージ時の傾き", "피해 기울임");
		add("FOV effects", "视场角效果", "Efectos de FOV", "Effets de champ de vision", "Sichtfeldeffekte", "Efeitos de campo de visão", "Эффекты поля зрения", "視野効果", "시야 효과");
		add("Sidebar", "侧边栏", "Barra lateral", "Barre latérale", "Seitenleiste", "Barra lateral", "Боковая панель", "サイドバー", "사이드바");
		add("Now playing", "正在播放", "Reproduciendo", "En cours de lecture", "Läuft gerade", "Tocando agora", "Сейчас играет", "再生中", "지금 재생 중");
		add("Build height limit", "建筑高度上限", "Límite de altura", "Limite de hauteur", "Bauhöhenlimit", "Limite de altura", "Предел высоты", "建築高度の上限", "건축 높이 한도");
		add("Frames per second.", "每秒帧数。", "Fotogramas por segundo.", "Images par seconde.", "Bilder pro Sekunde.", "Quadros por segundo.", "Кадры в секунду.", "1 秒あたりのフレーム数。", "초당 프레임 수.");
		add("Left and right clicks per second.", "每秒左键和右键点击次数。", "Clics izquierdos y derechos por segundo.", "Clics gauches et droits par seconde.", "Links- und Rechtsklicks pro Sekunde.", "Cliques esquerdos e direitos por segundo.", "Левые и правые клики в секунду.", "1 秒あたりの左右クリック数。", "초당 좌우 클릭 수.");
		add("Latency to the server. Hidden in singleplayer.", "与服务器的延迟。单人游戏中隐藏。", "Latencia con el servidor. Oculto en un jugador.", "Latence vers le serveur. Masqué en solo.", "Latenz zum Server. Im Einzelspieler ausgeblendet.", "Latência até o servidor. Oculto no modo um jogador.", "Задержка до сервера. Скрыто в одиночной игре.", "サーバーとの遅延。シングルプレイでは非表示。", "서버 지연 시간. 싱글플레이에서는 숨겨집니다.");
		add("Position and facing direction.", "位置和朝向。", "Posición y orientación.", "Position et direction.", "Position und Blickrichtung.", "Posição e direção.", "Позиция и направление взгляда.", "位置と向き。", "위치와 바라보는 방향.");
		add("WASD, mouse buttons and jump.", "WASD、鼠标按键和跳跃。", "WASD, botones del ratón y salto.", "ZQSD, boutons de souris et saut.", "WASD, Maustasten und Springen.", "WASD, botões do mouse e pulo.", "WASD, кнопки мыши и прыжок.", "WASD、マウスボタン、ジャンプ。", "WASD, 마우스 버튼, 점프.");
		add("Durability of your armor and held item.", "盔甲和手持物品的耐久度。", "Durabilidad de tu armadura y del objeto en la mano.", "Durabilité de l'armure et de l'objet tenu.", "Haltbarkeit von Rüstung und gehaltenem Gegenstand.", "Durabilidade da armadura e do item na mão.", "Прочность брони и предмета в руке.", "防具と手持ちアイテムの耐久値。", "갑옷과 들고 있는 아이템의 내구도.");
		add("Active effects and time left.", "当前效果和剩余时间。", "Efectos activos y tiempo restante.", "Effets actifs et temps restant.", "Aktive Effekte und Restzeit.", "Efeitos ativos e tempo restante.", "Активные эффекты и оставшееся время.", "有効な効果と残り時間。", "적용 중인 효과와 남은 시간.");
		add("Press sprint once to keep sprinting.", "按一次疾跑键即可保持疾跑。", "Pulsa correr una vez para seguir corriendo.", "Appuyez une fois sur sprint pour continuer à sprinter.", "Einmal Sprinten drücken, um weiter zu sprinten.", "Aperte correr uma vez para continuar correndo.", "Нажмите бег один раз, чтобы бежать дальше.", "ダッシュキーを一度押すとダッシュし続けます。", "달리기를 한 번 누르면 계속 달립니다.");
		add("Hold C to zoom in.", "按住 C 放大。", "Mantén C para hacer zoom.", "Maintenez C pour zoomer.", "Halte C zum Zoomen.", "Segure C para dar zoom.", "Удерживайте C для зума.", "C を押し続けるとズームします。", "C를 누르고 있으면 확대됩니다.");
		add("Movement leaves a short trail.", "移动时留下短暂的拖影。", "El movimiento deja una breve estela.", "Le mouvement laisse une courte traînée.", "Bewegung hinterlässt eine kurze Spur.", "O movimento deixa um rastro curto.", "Движение оставляет короткий след.", "動くと短い残像が出ます。", "움직이면 짧은 잔상이 남습니다.");
		add("Smooths shaky mouse movement. View only on servers.", "平滑抖动的鼠标移动。在服务器上仅影响画面。", "Suaviza el ratón tembloroso. En servidores solo afecta a la vista.", "Lisse les mouvements de souris tremblants. Vue seulement sur les serveurs.", "Glättet zittrige Mausbewegungen. Auf Servern nur die Ansicht.", "Suaviza o mouse tremido. Em servidores, só a visão.", "Сглаживает дрожание мыши. На серверах только для вида.", "マウスの揺れをなめらかにします。サーバーでは表示のみ。", "흔들리는 마우스 움직임을 부드럽게 합니다. 서버에서는 화면에만 적용됩니다.");
		add("See clearly in the dark.", "在黑暗中看得清楚。", "Ve con claridad en la oscuridad.", "Voyez clairement dans le noir.", "Sieh im Dunkeln klar.", "Veja claramente no escuro.", "Чёткая видимость в темноте.", "暗い場所でもはっきり見えます。", "어둠 속에서도 잘 보입니다.");
		add("Shows skies from resource packs.", "显示资源包中的天空。", "Muestra cielos de paquetes de recursos.", "Affiche les ciels des packs de ressources.", "Zeigt Himmel aus Ressourcenpaketen.", "Mostra céus de pacotes de recursos.", "Показывает небо из наборов ресурсов.", "リソースパックの空を表示します。", "리소스 팩의 하늘을 보여 줍니다.");
		add("Swing while blocking, like 1.7.", "格挡时也能挥动，和 1.7 一样。", "Balancea mientras bloqueas, como en 1.7.", "Frappez en parant, comme en 1.7.", "Schwingen beim Blocken, wie in 1.7.", "Balance enquanto bloqueia, como no 1.7.", "Взмах при блоке, как в 1.7.", "ガード中も振ります（1.7 と同じ）。", "막는 중에도 휘두릅니다(1.7처럼).");
		add("Eating and drinking swing like 1.7.", "进食和饮用时像 1.7 一样摆动。", "Comer y beber se balancean como en 1.7.", "Manger et boire balancent comme en 1.7.", "Essen und Trinken schwingen wie in 1.7.", "Comer e beber balançam como no 1.7.", "Еда и питьё качаются как в 1.7.", "食べる・飲む動きが 1.7 と同じになります。", "먹고 마실 때 1.7처럼 흔들립니다.");
		add("The camera glides lower when you sneak.", "潜行时镜头平滑下降。", "La cámara baja suavemente al agacharte.", "La caméra descend en douceur quand vous vous accroupissez.", "Die Kamera gleitet beim Schleichen nach unten.", "A câmera desce suavemente ao agachar.", "Камера плавно опускается при приседании.", "スニーク時にカメラがなめらかに下がります。", "웅크리면 카메라가 부드럽게 내려갑니다.");
		add("Smooth bobbing, or a ripping swing while eating and drinking.", "进食和饮用时平滑晃动，或撕咬式摆动。", "Balanceo suave o un tirón al comer y beber.", "Balancement fluide ou arrachage en mangeant et buvant.", "Weiches Wippen oder ein Reißen beim Essen und Trinken.", "Balanço suave ou um puxão ao comer e beber.", "Плавное покачивание или рывки при еде и питье.", "食事中になめらかに揺れるか、かじるように振ります。", "먹고 마실 때 부드럽게 흔들리거나 뜯는 듯이 움직입니다.");
		add("Camera tilts when you take damage.", "受到伤害时镜头倾斜。", "La cámara se inclina al recibir daño.", "La caméra s'incline quand vous subissez des dégâts.", "Die Kamera neigt sich bei Schaden.", "A câmera inclina ao levar dano.", "Камера наклоняется при получении урона.", "ダメージを受けるとカメラが傾きます。", "피해를 입으면 카메라가 기울어집니다.");
		add("Sprinting, flying and bows change your FOV.", "疾跑、飞行和拉弓会改变视场角。", "Correr, volar y los arcos cambian tu FOV.", "Sprinter, voler et les arcs changent votre champ de vision.", "Sprinten, Fliegen und Bögen ändern das Sichtfeld.", "Correr, voar e arcos mudam seu campo de visão.", "Бег, полёт и лук меняют поле зрения.", "ダッシュ、飛行、弓で視野が変わります。", "달리기, 비행, 활이 시야를 바꿉니다.");
		add("Cleaner scoreboard sidebar.", "更简洁的计分板侧边栏。", "Barra lateral de puntuación más limpia.", "Barre latérale du tableau des scores épurée.", "Aufgeräumtere Scoreboard-Seitenleiste.", "Barra lateral do placar mais limpa.", "Аккуратная боковая панель счёта.", "すっきりしたスコアボード。", "더 깔끔한 점수판 사이드바.");
		add("Music or videos playing on your computer, with play, pause and skip. macOS.", "电脑上正在播放的音乐或视频，可播放、暂停和跳过。仅 macOS。", "Música o vídeos que suenan en tu ordenador, con reproducir, pausar y saltar. macOS.", "Musique ou vidéos en lecture sur l'ordinateur, avec lecture, pause et piste suivante. macOS.", "Musik oder Videos auf deinem Computer, mit Abspielen, Pause und Überspringen. macOS.", "Música ou vídeos tocando no computador, com tocar, pausar e pular. macOS.", "Музыка или видео на компьютере: пуск, пауза, пропуск. macOS.", "パソコンで再生中の音楽や動画。再生・一時停止・スキップ可。macOS。", "컴퓨터에서 재생 중인 음악이나 동영상. 재생, 일시 정지, 건너뛰기. macOS.");
		add("Warns near the build height limit.", "接近建筑高度上限时提醒。", "Avisa cerca del límite de altura.", "Avertit près de la limite de hauteur.", "Warnt nahe der Bauhöhe.", "Avisa perto do limite de altura.", "Предупреждает у предела высоты.", "建築高度の上限が近いと警告します。", "건축 높이 한도에 가까우면 알려 줍니다.");
	}
}
