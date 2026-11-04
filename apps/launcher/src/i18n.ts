import { createElement, Fragment, type ReactNode } from "react";

/** Launcher languages. "system" follows the OS; anything without a translation falls back to English. */
export const languages = [
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
] as const;

export type Language = (typeof languages)[number]["value"];
export type LanguagePref = Language | "system";

const order: Language[] = languages.map((l) => l.value);

/**
 * One row per English string: [English, 中文, Español, Français, Deutsch, Português, Русский, 日本語, 한국어].
 * {name} placeholders are filled by t(); keep them in every column.
 */
const rows: string[][] = [
  // Navigation and top bar
  ["Home", "首页", "Inicio", "Accueil", "Start", "Início", "Главная", "ホーム", "홈"],
  ["Instances", "实例", "Instancias", "Instances", "Instanzen", "Instâncias", "Сборки", "インスタンス", "인스턴스"],
  ["Browse", "浏览", "Explorar", "Parcourir", "Entdecken", "Explorar", "Обзор", "探す", "찾아보기"],
  ["Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client", "Novex Client"],
  ["Settings", "设置", "Ajustes", "Paramètres", "Einstellungen", "Configurações", "Настройки", "設定", "설정"],
  ["HUD mod for every version, built in.", "内置 HUD 模组，支持所有版本。", "Mod de HUD integrado para cada versión.", "Mod HUD intégré, pour chaque version.", "Eingebaute HUD-Mod für jede Version.", "Mod de HUD integrado para todas as versões.", "Встроенный HUD-мод для всех версий.", "全バージョン対応の HUD MOD を内蔵。", "모든 버전용 HUD 모드 내장."],
  ["Find mods and modpacks", "查找模组和整合包", "Buscar mods y modpacks", "Chercher des mods et modpacks", "Mods und Modpacks finden", "Buscar mods e modpacks", "Найти моды и сборки", "MOD とモッドパックを探す", "모드와 모드팩 찾기"],
  ["New instance", "新建实例", "Nueva instancia", "Nouvelle instance", "Neue Instanz", "Nova instância", "Новая сборка", "新規インスタンス", "새 인스턴스"],
  ["Sign in", "登录", "Iniciar sesión", "Se connecter", "Anmelden", "Entrar", "Войти", "サインイン", "로그인"],
  ["Update to {version}", "更新到 {version}", "Actualizar a {version}", "Mettre à jour vers {version}", "Auf {version} aktualisieren", "Atualizar para {version}", "Обновить до {version}", "{version} に更新", "{version}(으)로 업데이트"],
  ["New interface {version}", "新界面 {version}", "Nueva interfaz {version}", "Nouvelle interface {version}", "Neue Oberfläche {version}", "Nova interface {version}", "Новый интерфейс {version}", "新しいインターフェース {version}", "새 인터페이스 {version}"],
  ["Updating", "正在更新", "Actualizando", "Mise à jour", "Wird aktualisiert", "Atualizando", "Обновление", "更新中", "업데이트 중"],
  ["Dismiss", "关闭", "Descartar", "Fermer", "Schließen", "Dispensar", "Закрыть", "閉じる", "닫기"],

  // Home
  ["Running", "运行中", "En ejecución", "En cours", "Läuft", "Em execução", "Запущено", "実行中", "실행 중"],
  ["Ready to play", "可以开始游戏", "Listo para jugar", "Prêt à jouer", "Bereit zum Spielen", "Pronto para jogar", "Готово к игре", "プレイ準備完了", "플레이 준비 완료"],
  ["Last played {time}", "上次游玩：{time}", "Última partida: {time}", "Dernière partie : {time}", "Zuletzt gespielt: {time}", "Jogado por último: {time}", "Последняя игра: {time}", "最終プレイ：{time}", "마지막 플레이: {time}"],
  ["Switch instance", "切换实例", "Cambiar instancia", "Changer d'instance", "Instanz wechseln", "Trocar instância", "Сменить сборку", "インスタンスを切り替え", "인스턴스 전환"],
  ["Play", "开始游戏", "Jugar", "Jouer", "Spielen", "Jogar", "Играть", "プレイ", "플레이"],
  ["Stop", "停止", "Detener", "Arrêter", "Beenden", "Parar", "Остановить", "停止", "중지"],
  ["Launching", "正在启动", "Iniciando", "Lancement", "Startet", "Iniciando", "Запуск", "起動中", "실행하는 중"],
  ["Resource packs", "资源包", "Paquetes de recursos", "Packs de ressources", "Ressourcenpakete", "Pacotes de recursos", "Ресурспаки", "リソースパック", "리소스 팩"],
  ["Mods", "模组", "Mods", "Mods", "Mods", "Mods", "Моды", "MOD", "모드"],
  ["Worlds", "世界", "Mundos", "Mondes", "Welten", "Mundos", "Миры", "ワールド", "월드"],
  ["Screenshots", "截图", "Capturas", "Captures d'écran", "Screenshots", "Capturas de tela", "Скриншоты", "スクリーンショット", "스크린샷"],
  ["Instance folder", "实例文件夹", "Carpeta de la instancia", "Dossier de l'instance", "Instanzordner", "Pasta da instância", "Папка сборки", "インスタンスフォルダ", "인스턴스 폴더"],
  ["Manage content", "管理内容", "Gestionar contenido", "Gérer le contenu", "Inhalte verwalten", "Gerenciar conteúdo", "Управление контентом", "コンテンツを管理", "콘텐츠 관리"],
  ["Logs", "日志", "Registros", "Journaux", "Protokolle", "Logs", "Логи", "ログ", "로그"],
  ["Copy", "复制", "Copiar", "Copier", "Kopieren", "Copiar", "Копировать", "コピー", "복사"],
  ["Copied", "已复制", "Copiado", "Copié", "Kopiert", "Copiado", "Скопировано", "コピーしました", "복사됨"],
  ["Expand", "展开", "Ampliar", "Agrandir", "Vergrößern", "Expandir", "Развернуть", "拡大", "펼치기"],
  ["Live", "实时", "En directo", "En direct", "Live", "Ao vivo", "В реальном времени", "ライブ", "실시간"],
  ["This session", "本次会话", "Esta sesión", "Cette session", "Diese Sitzung", "Esta sessão", "Этот сеанс", "このセッション", "이번 세션"],
  ["Last session", "上次会话", "Última sesión", "Dernière session", "Letzte Sitzung", "Última sessão", "Прошлый сеанс", "前回のセッション", "지난 세션"],
  ["No logs yet. Press Play and the game's output shows up here.", "暂无日志。点击“开始游戏”后，游戏输出会显示在这里。", "Aún no hay registros. Pulsa Jugar y la salida del juego aparecerá aquí.", "Pas encore de journaux. Cliquez sur Jouer et la sortie du jeu s'affichera ici.", "Noch keine Protokolle. Klicke auf Spielen, dann erscheint hier die Ausgabe des Spiels.", "Ainda não há logs. Clique em Jogar e a saída do jogo aparece aqui.", "Логов пока нет. Нажмите «Играть», и вывод игры появится здесь.", "ログはまだありません。プレイを押すと、ゲームの出力がここに表示されます。", "아직 로그가 없습니다. 플레이를 누르면 게임 출력이 여기에 표시됩니다."],
  ["Overview", "概览", "Resumen", "Aperçu", "Übersicht", "Visão geral", "Обзор", "概要", "개요"],
  ["Play time", "游戏时长", "Tiempo de juego", "Temps de jeu", "Spielzeit", "Tempo de jogo", "Время в игре", "プレイ時間", "플레이 시간"],
  ["{count} modded", "{count} 个有模组", "{count} con mods", "{count} moddées", "{count} mit Mods", "{count} com mods", "с модами: {count}", "MOD あり {count}", "모드 {count}개"],
  ["all instances", "所有实例", "todas las instancias", "toutes les instances", "alle Instanzen", "todas as instâncias", "все сборки", "全インスタンス", "모든 인스턴스"],
  ["What's new", "新功能", "Novedades", "Nouveautés", "Neuigkeiten", "Novidades", "Что нового", "新機能", "새로운 기능"],
  ["Themes", "主题", "Temas", "Thèmes", "Designs", "Temas", "Темы", "テーマ", "테마"],
  ["Pick a color theme with liquid-glass panels in Settings → Appearance.", "在“设置 → 外观”中选择带液态玻璃面板的配色主题。", "Elige un tema de color con paneles de vidrio líquido en Ajustes → Apariencia.", "Choisissez un thème de couleur aux panneaux de verre liquide dans Paramètres → Apparence.", "Wähle unter Einstellungen → Darstellung ein Farbdesign mit Flüssigglas-Flächen.", "Escolha um tema de cor com painéis de vidro líquido em Configurações → Aparência.", "Выберите цветовую тему с панелями из «жидкого стекла» в Настройки → Оформление.", "設定 → 外観 で、リキッドグラスのパネルを使ったカラーテーマを選べます。", "설정 → 모양에서 리퀴드 글래스 패널 색상 테마를 고를 수 있습니다."],
  ["Mod updates", "模组更新", "Actualizaciones de mods", "Mises à jour des mods", "Mod-Updates", "Atualizações de mods", "Обновления модов", "MOD の更新", "모드 업데이트"],
  ["Open an instance to see its mods and packs, and update them in one click.", "打开实例即可查看其模组和资源包，并一键更新。", "Abre una instancia para ver sus mods y paquetes y actualizarlos con un clic.", "Ouvrez une instance pour voir ses mods et packs, et les mettre à jour en un clic.", "Öffne eine Instanz, um ihre Mods und Pakete zu sehen und mit einem Klick zu aktualisieren.", "Abra uma instância para ver os mods e pacotes e atualizá-los com um clique.", "Откройте сборку, чтобы увидеть её моды и паки и обновить их в один клик.", "インスタンスを開くと、MOD やパックを確認し、ワンクリックで更新できます。", "인스턴스를 열면 모드와 팩을 확인하고 한 번에 업데이트할 수 있습니다."],
  ["Offline accounts", "离线账户", "Cuentas sin conexión", "Comptes hors ligne", "Offline-Konten", "Contas offline", "Офлайн-аккаунты", "オフラインアカウント", "오프라인 계정"],
  ["Add offline accounts for singleplayer and LAN once you've signed in.", "登录后，可添加用于单人游戏和局域网的离线账户。", "Tras iniciar sesión, añade cuentas sin conexión para un jugador y LAN.", "Une fois connecté, ajoutez des comptes hors ligne pour le solo et le LAN.", "Nach der Anmeldung kannst du Offline-Konten für Einzelspieler und LAN hinzufügen.", "Depois de entrar, adicione contas offline para um jogador e LAN.", "После входа можно добавить офлайн-аккаунты для одиночной игры и LAN.", "サインイン後、シングルプレイと LAN 用のオフラインアカウントを追加できます。", "로그인한 뒤 싱글플레이와 LAN용 오프라인 계정을 추가할 수 있습니다."],
  ["Welcome to Novex", "欢迎使用 Novex", "Te damos la bienvenida a Novex", "Bienvenue dans Novex", "Willkommen bei Novex", "Boas-vindas ao Novex", "Добро пожаловать в Novex", "Novex へようこそ", "Novex에 오신 것을 환영합니다"],
  ["Create an instance to pick a version, then hit play.", "创建一个实例并选择版本，然后开始游戏。", "Crea una instancia para elegir una versión y luego pulsa Jugar.", "Créez une instance pour choisir une version, puis lancez le jeu.", "Erstelle eine Instanz, wähle eine Version und leg los.", "Crie uma instância para escolher uma versão e depois clique em Jogar.", "Создайте сборку, выберите версию и нажмите «Играть».", "インスタンスを作成してバージョンを選び、プレイを押しましょう。", "인스턴스를 만들어 버전을 고른 다음 플레이를 누르세요."],

  // Time
  ["Never played", "从未游玩", "Nunca jugada", "Jamais jouée", "Nie gespielt", "Nunca jogada", "Ещё не запускалась", "未プレイ", "플레이 기록 없음"],
  ["Just now", "刚刚", "Justo ahora", "À l'instant", "Gerade eben", "Agora mesmo", "Только что", "たった今", "방금"],
  ["{n} min ago", "{n} 分钟前", "hace {n} min", "il y a {n} min", "vor {n} Min.", "há {n} min", "{n} мин назад", "{n} 分前", "{n}분 전"],
  ["{n} h ago", "{n} 小时前", "hace {n} h", "il y a {n} h", "vor {n} Std.", "há {n} h", "{n} ч назад", "{n} 時間前", "{n}시간 전"],
  ["{n} d ago", "{n} 天前", "hace {n} d", "il y a {n} j", "vor {n} T.", "há {n} d", "{n} дн назад", "{n} 日前", "{n}일 전"],

  // Instances
  ["Each instance has its own version, worlds, mods and settings.", "每个实例都有独立的版本、世界、模组和设置。", "Cada instancia tiene su propia versión, mundos, mods y ajustes.", "Chaque instance a sa propre version, ses mondes, ses mods et ses réglages.", "Jede Instanz hat eigene Version, Welten, Mods und Einstellungen.", "Cada instância tem sua própria versão, mundos, mods e configurações.", "У каждой сборки своя версия, миры, моды и настройки.", "インスタンスごとにバージョン、ワールド、MOD、設定が分かれています。", "인스턴스마다 버전, 월드, 모드, 설정이 따로 있습니다."],
  ["Import", "导入", "Importar", "Importer", "Importieren", "Importar", "Импорт", "インポート", "가져오기"],
  ["Import a .mrpack or CurseForge modpack .zip", "导入 .mrpack 或 CurseForge 整合包 .zip", "Importar un .mrpack o un .zip de modpack de CurseForge", "Importer un .mrpack ou un modpack CurseForge en .zip", "Eine .mrpack- oder CurseForge-Modpack-.zip importieren", "Importar um .mrpack ou um .zip de modpack do CurseForge", "Импорт .mrpack или .zip-сборки CurseForge", ".mrpack または CurseForge モッドパックの .zip をインポート", ".mrpack 또는 CurseForge 모드팩 .zip 가져오기"],
  ["No instances", "没有实例", "No hay instancias", "Aucune instance", "Keine Instanzen", "Nenhuma instância", "Нет сборок", "インスタンスがありません", "인스턴스 없음"],
  ["Create a vanilla or modded instance, install a modpack from Browse, or import a .mrpack or CurseForge .zip.", "创建原版或模组实例，从“浏览”安装整合包，或导入 .mrpack / CurseForge .zip。", "Crea una instancia vanilla o con mods, instala un modpack desde Explorar o importa un .mrpack o .zip de CurseForge.", "Créez une instance vanilla ou moddée, installez un modpack depuis Parcourir, ou importez un .mrpack ou un .zip CurseForge.", "Erstelle eine Vanilla- oder Mod-Instanz, installiere ein Modpack über Entdecken oder importiere eine .mrpack- bzw. CurseForge-.zip.", "Crie uma instância vanilla ou com mods, instale um modpack em Explorar ou importe um .mrpack ou .zip do CurseForge.", "Создайте ванильную или модовую сборку, установите сборку из «Обзора» или импортируйте .mrpack либо .zip CurseForge.", "バニラまたは MOD 入りのインスタンスを作成するか、探すからモッドパックを入れるか、.mrpack / CurseForge の .zip をインポートします。", "바닐라 또는 모드 인스턴스를 만들거나, 찾아보기에서 모드팩을 설치하거나, .mrpack 또는 CurseForge .zip을 가져오세요."],
  ["Mods and packs", "模组和资源包", "Mods y paquetes", "Mods et packs", "Mods und Pakete", "Mods e pacotes", "Моды и паки", "MOD とパック", "모드와 팩"],
  ["Open folder", "打开文件夹", "Abrir carpeta", "Ouvrir le dossier", "Ordner öffnen", "Abrir pasta", "Открыть папку", "フォルダを開く", "폴더 열기"],
  ["Instance settings", "实例设置", "Ajustes de la instancia", "Réglages de l'instance", "Instanzeinstellungen", "Configurações da instância", "Настройки сборки", "インスタンス設定", "인스턴스 설정"],
  ["Delete", "删除", "Eliminar", "Supprimer", "Löschen", "Excluir", "Удалить", "削除", "삭제"],
  ["Click again to delete", "再次点击以删除", "Haz clic otra vez para eliminar", "Cliquez à nouveau pour supprimer", "Zum Löschen erneut klicken", "Clique de novo para excluir", "Нажмите ещё раз, чтобы удалить", "もう一度クリックすると削除します", "한 번 더 누르면 삭제됩니다"],
  ["Sure?", "确定？", "¿Seguro?", "Sûr ?", "Sicher?", "Certeza?", "Точно?", "よろしいですか？", "확실한가요?"],

  // Browse
  ["Modpacks", "整合包", "Modpacks", "Modpacks", "Modpacks", "Modpacks", "Сборки", "モッドパック", "모드팩"],
  ["Shaders", "光影", "Shaders", "Shaders", "Shader", "Shaders", "Шейдеры", "シェーダー", "셰이더"],
  ["Find modpacks, mods, resource packs and shaders.", "查找整合包、模组、资源包和光影。", "Busca modpacks, mods, paquetes de recursos y shaders.", "Trouvez des modpacks, mods, packs de ressources et shaders.", "Finde Modpacks, Mods, Ressourcenpakete und Shader.", "Encontre modpacks, mods, pacotes de recursos e shaders.", "Ищите сборки, моды, ресурспаки и шейдеры.", "モッドパック、MOD、リソースパック、シェーダーを探せます。", "모드팩, 모드, 리소스 팩, 셰이더를 찾아보세요."],
  ["Install", "安装", "Instalar", "Installer", "Installieren", "Instalar", "Установить", "インストール", "설치"],
  ["Installed", "已安装", "Instalado", "Installé", "Installiert", "Instalado", "Установлено", "インストール済み", "설치됨"],
  ["Versions", "版本", "Versiones", "Versions", "Versionen", "Versões", "Версии", "バージョン", "버전"],
  ["Couldn't search", "搜索失败", "No se pudo buscar", "Recherche impossible", "Suche fehlgeschlagen", "Não foi possível pesquisar", "Не удалось выполнить поиск", "検索できませんでした", "검색할 수 없습니다"],
  ["No instance to install into", "没有可安装到的实例", "No hay ninguna instancia donde instalar", "Aucune instance où installer", "Keine Instanz zum Installieren", "Nenhuma instância para instalar", "Нет сборки для установки", "インストール先のインスタンスがありません", "설치할 인스턴스가 없습니다"],
  ["Create an instance first, or install a modpack.", "请先创建实例，或安装一个整合包。", "Crea primero una instancia o instala un modpack.", "Créez d'abord une instance, ou installez un modpack.", "Erstelle zuerst eine Instanz oder installiere ein Modpack.", "Crie uma instância primeiro ou instale um modpack.", "Сначала создайте сборку или установите модпак.", "先にインスタンスを作成するか、モッドパックをインストールしてください。", "먼저 인스턴스를 만들거나 모드팩을 설치하세요."],
  ["No results", "没有结果", "Sin resultados", "Aucun résultat", "Keine Ergebnisse", "Nenhum resultado", "Ничего не найдено", "結果がありません", "결과 없음"],
  ["Try a different search.", "换个关键词试试。", "Prueba con otra búsqueda.", "Essayez une autre recherche.", "Versuche eine andere Suche.", "Tente outra pesquisa.", "Попробуйте другой запрос.", "別のキーワードで検索してください。", "다른 검색어를 입력해 보세요."],

  // Novex Client
  ["FPS", "帧数", "FPS", "FPS", "FPS", "FPS", "FPS", "FPS", "FPS"],
  ["CPS", "点击数", "CPS", "CPS", "CPS", "CPS", "CPS", "CPS", "CPS"],
  ["Ping", "延迟", "Ping", "Ping", "Ping", "Ping", "Пинг", "Ping", "핑"],
  ["Coordinates", "坐标", "Coordenadas", "Coordonnées", "Koordinaten", "Coordenadas", "Координаты", "座標", "좌표"],
  ["Keystrokes", "按键显示", "Teclas", "Touches", "Tastenanzeige", "Teclas", "Нажатия клавиш", "キー表示", "키 입력"],
  ["Armor status", "盔甲状态", "Estado de armadura", "État de l'armure", "Rüstungsstatus", "Status da armadura", "Состояние брони", "防具の状態", "방어구 상태"],
  ["Potion effects", "药水效果", "Efectos de pociones", "Effets de potions", "Trankeffekte", "Efeitos de poções", "Эффекты зелий", "ポーション効果", "포션 효과"],
  ["Toggle sprint", "切换疾跑", "Sprint permanente", "Sprint permanent", "Sprinten umschalten", "Corrida contínua", "Переключение бега", "ダッシュ切り替え", "달리기 전환"],
  ["Zoom", "缩放", "Zoom", "Zoom", "Zoom", "Zoom", "Приближение", "ズーム", "확대"],
  ["Motion blur", "动态模糊", "Desenfoque de movimiento", "Flou de mouvement", "Bewegungsunschärfe", "Desfoque de movimento", "Размытие движения", "モーションブラー", "모션 블러"],
  ["1.7 block hit", "1.7 格挡攻击", "Golpe con bloqueo 1.7", "Coup bloqué 1.7", "1.7-Blockhit", "Golpe com bloqueio 1.7", "Блок-хит 1.7", "1.7 ブロックヒット", "1.7 블록 히트"],
  ["1.7 eating", "1.7 进食动画", "Comer al estilo 1.7", "Animation de repas 1.7", "1.7-Essanimation", "Comer estilo 1.7", "Еда как в 1.7", "1.7 の食べる動作", "1.7 먹기 동작"],
  ["Damage tilt", "受伤镜头倾斜", "Inclinación al recibir daño", "Inclinaison aux dégâts", "Schadensneigung", "Inclinação ao levar dano", "Наклон при уроне", "ダメージ時の傾き", "피해 시 기울기"],
  ["FOV effects", "视野效果", "Efectos de campo de visión", "Effets de champ de vision", "Sichtfeld-Effekte", "Efeitos de campo de visão", "Эффекты поля зрения", "視野エフェクト", "시야 효과"],
  ["Sidebar", "侧边计分板", "Barra lateral", "Barre latérale", "Seitenleiste", "Barra lateral", "Боковая панель", "サイドバー", "사이드바"],
  ["Build height limit", "建筑高度限制", "Límite de altura de construcción", "Limite de hauteur de construction", "Bauhöhenlimit", "Limite de altura de construção", "Лимит высоты строительства", "建築高さ制限", "건축 높이 제한"],
  ["1.8.9 only", "仅限 1.8.9", "Solo 1.8.9", "1.8.9 uniquement", "Nur 1.8.9", "Só 1.8.9", "Только 1.8.9", "1.8.9 のみ", "1.8.9 전용"],
  ["Fabric API and Sodium", "Fabric API 和 Sodium", "Fabric API y Sodium", "Fabric API et Sodium", "Fabric API und Sodium", "Fabric API e Sodium", "Fabric API и Sodium", "Fabric API と Sodium", "Fabric API와 Sodium"],
  ["Embeddium where available", "Embeddium（如有）", "Embeddium si está disponible", "Embeddium si disponible", "Embeddium, falls verfügbar", "Embeddium, se disponível", "Embeddium, если есть", "Embeddium（ある場合）", "Embeddium(지원 시)"],
  ["Sodium where available", "Sodium（如有）", "Sodium si está disponible", "Sodium si disponible", "Sodium, falls verfügbar", "Sodium, se disponível", "Sodium, если есть", "Sodium（ある場合）", "Sodium(지원 시)"],
  ["No instances yet", "还没有实例", "Aún no hay instancias", "Pas encore d'instance", "Noch keine Instanzen", "Ainda não há instâncias", "Сборок пока нет", "まだインスタンスがありません", "아직 인스턴스가 없습니다"],
  ["Novex Client runs on Fabric, Quilt, NeoForge and Forge instances, from 1.8.9 to 26.3.", "Novex Client 可在 Fabric、Quilt、NeoForge 和 Forge 实例上运行，支持 1.8.9 到 26.3。", "Novex Client funciona en instancias de Fabric, Quilt, NeoForge y Forge, de la 1.8.9 a la 26.3.", "Novex Client fonctionne sur les instances Fabric, Quilt, NeoForge et Forge, de 1.8.9 à 26.3.", "Novex Client läuft auf Fabric-, Quilt-, NeoForge- und Forge-Instanzen von 1.8.9 bis 26.3.", "O Novex Client roda em instâncias Fabric, Quilt, NeoForge e Forge, da 1.8.9 à 26.3.", "Novex Client работает в сборках Fabric, Quilt, NeoForge и Forge, от 1.8.9 до 26.3.", "Novex Client は 1.8.9〜26.3 の Fabric、Quilt、NeoForge、Forge インスタンスで動作します。", "Novex Client는 1.8.9부터 26.3까지 Fabric, Quilt, NeoForge, Forge 인스턴스에서 작동합니다."],
  ["A HUD mod for your instances, on Fabric, Quilt, NeoForge and Forge. Information only: no reach, hitbox, auto-click or ESP.", "适用于 Fabric、Quilt、NeoForge 和 Forge 实例的 HUD 模组。只显示信息：没有攻击距离、碰撞箱、自动点击或透视。", "Un mod de HUD para tus instancias de Fabric, Quilt, NeoForge y Forge. Solo información: sin alcance, hitbox, autoclic ni ESP.", "Un mod HUD pour vos instances Fabric, Quilt, NeoForge et Forge. Information uniquement : ni portée, ni hitbox, ni autoclic, ni ESP.", "Eine HUD-Mod für deine Fabric-, Quilt-, NeoForge- und Forge-Instanzen. Nur Informationen: kein Reach, keine Hitboxen, kein Autoklick, kein ESP.", "Um mod de HUD para suas instâncias Fabric, Quilt, NeoForge e Forge. Só informação: sem alcance, hitbox, autoclique ou ESP.", "HUD-мод для сборок Fabric, Quilt, NeoForge и Forge. Только информация: без увеличенной дальности, хитбоксов, автокликера и ESP.", "Fabric、Quilt、NeoForge、Forge のインスタンス向け HUD MOD。表示のみで、リーチ・ヒットボックス・オートクリック・ESP はありません。", "Fabric, Quilt, NeoForge, Forge 인스턴스용 HUD 모드입니다. 정보 표시만 하며 리치, 히트박스, 자동 클릭, ESP는 없습니다."],
  ["On for this instance.", "已为此实例开启。", "Activado en esta instancia.", "Activé pour cette instance.", "Für diese Instanz an.", "Ativado nesta instância.", "Включён для этой сборки.", "このインスタンスでオンです。", "이 인스턴스에서 켜져 있습니다."],
  ["Off. Turning it on also installs {mods}.", "已关闭。开启时还会安装 {mods}。", "Desactivado. Al activarlo también se instala {mods}.", "Désactivé. L'activer installe aussi {mods}.", "Aus. Beim Einschalten wird auch {mods} installiert.", "Desativado. Ao ativar, também instala {mods}.", "Выключен. При включении также установится {mods}.", "オフ。オンにすると {mods} もインストールされます。", "꺼짐. 켜면 {mods}도 함께 설치됩니다."],
  ["Modules", "模块", "Módulos", "Modules", "Module", "Módulos", "Модули", "モジュール", "모듈"],
  ["Zoom strength", "缩放倍数", "Intensidad del zoom", "Puissance du zoom", "Zoomstärke", "Intensidade do zoom", "Сила приближения", "ズーム倍率", "확대 배율"],
  ["How far holding the zoom key magnifies.", "按住缩放键时放大的程度。", "Cuánto amplía mantener pulsada la tecla de zoom.", "Grossissement lorsque vous maintenez la touche de zoom.", "Wie stark das Halten der Zoomtaste vergrößert.", "Quanto segurar a tecla de zoom amplia.", "Насколько приближает удержание клавиши зума.", "ズームキーを押している間の拡大率です。", "확대 키를 누르고 있을 때의 배율입니다."],
  ["Motion blur strength", "动态模糊强度", "Intensidad del desenfoque", "Intensité du flou", "Stärke der Unschärfe", "Intensidade do desfoque", "Сила размытия", "モーションブラーの強さ", "모션 블러 강도"],
  ["Light", "轻微", "Suave", "Léger", "Leicht", "Leve", "Слабое", "弱", "약하게"],
  ["Medium", "中等", "Media", "Moyen", "Mittel", "Médio", "Среднее", "中", "보통"],
  ["Strong", "强烈", "Fuerte", "Fort", "Stark", "Forte", "Сильное", "強", "강하게"],
  ["Sidebar numbers", "计分板分数", "Números de la barra lateral", "Nombres de la barre latérale", "Zahlen in der Seitenleiste", "Números da barra lateral", "Числа на боковой панели", "サイドバーの数字", "사이드바 숫자"],
  ["Show the red score numbers on the right of the sidebar.", "在计分板右侧显示红色分数。", "Muestra los números rojos de puntuación a la derecha de la barra lateral.", "Affiche les scores rouges à droite de la barre latérale.", "Zeigt die roten Punktzahlen rechts in der Seitenleiste.", "Mostra os números vermelhos de pontuação à direita da barra lateral.", "Показывать красные очки справа на боковой панели.", "サイドバー右側の赤いスコアを表示します。", "사이드바 오른쪽에 빨간 점수를 표시합니다."],
  ["Build height", "建筑高度", "Altura de construcción", "Hauteur de construction", "Bauhöhe", "Altura de construção", "Высота строительства", "建築高さ", "건축 높이"],
  ["Highest Y you can place blocks at. Hypixel maps often use lower limits.", "可放置方块的最高 Y 坐标。Hypixel 的地图通常更低。", "La Y más alta donde puedes colocar bloques. Los mapas de Hypixel suelen tener límites más bajos.", "Y maximal où poser des blocs. Les cartes Hypixel ont souvent des limites plus basses.", "Höchste Y-Position zum Platzieren von Blöcken. Hypixel-Karten haben oft niedrigere Grenzen.", "O Y mais alto onde dá para colocar blocos. Mapas do Hypixel costumam ter limites menores.", "Максимальная высота Y для установки блоков. На картах Hypixel она часто ниже.", "ブロックを置ける最高の Y 座標です。Hypixel のマップでは低めのことが多いです。", "블록을 놓을 수 있는 최대 Y 좌표입니다. Hypixel 맵은 보통 더 낮습니다."],
  ["Changes here apply the next time the game starts.", "这里的更改会在下次启动游戏时生效。", "Los cambios se aplican la próxima vez que inicies el juego.", "Les changements s'appliquent au prochain lancement du jeu.", "Änderungen gelten ab dem nächsten Spielstart.", "As alterações valem na próxima vez que o jogo iniciar.", "Изменения применятся при следующем запуске игры.", "変更は次回ゲームを起動したときに反映されます。", "변경 사항은 다음에 게임을 시작할 때 적용됩니다."],
  ["In game or on any menu, press {menu} to move and resize the HUD; its Settings button opens the modules. Hold {zoom} to zoom. The title screen has a Novex Client button too.", "在游戏中或任何菜单里按 {menu} 可移动和缩放 HUD，点中间的“设置”打开模块。按住 {zoom} 缩放视野。标题画面也有 Novex Client 按钮。", "En el juego o en cualquier menú, pulsa {menu} para mover y cambiar el tamaño del HUD; su botón Ajustes abre los módulos. Mantén {zoom} para hacer zoom. La pantalla de título también tiene un botón Novex Client.", "En jeu ou dans n'importe quel menu, appuyez sur {menu} pour déplacer et redimensionner le HUD ; son bouton Paramètres ouvre les modules. Maintenez {zoom} pour zoomer. L'écran titre a aussi un bouton Novex Client.", "Drücke im Spiel oder in jedem Menü {menu}, um das HUD zu verschieben und in der Größe zu ändern; der Einstellungen-Knopf öffnet die Module. Halte {zoom} zum Zoomen. Auch der Titelbildschirm hat einen Novex-Client-Knopf.", "No jogo ou em qualquer menu, aperte {menu} para mover e redimensionar o HUD; o botão Configurações abre os módulos. Segure {zoom} para dar zoom. A tela inicial também tem um botão Novex Client.", "В игре или в любом меню нажмите {menu}, чтобы перемещать и масштабировать HUD; кнопка «Настройки» открывает модули. Удерживайте {zoom} для приближения. На главном экране тоже есть кнопка Novex Client.", "ゲーム中やどのメニューでも {menu} で HUD を移動・拡大縮小でき、中央の設定ボタンでモジュールを開けます。{zoom} を押し続けるとズームします。タイトル画面にも Novex Client ボタンがあります。", "게임이나 어떤 메뉴에서든 {menu}를 누르면 HUD를 옮기고 크기를 바꿀 수 있고, 가운데 설정 버튼으로 모듈을 엽니다. {zoom}을 누르고 있으면 확대됩니다. 타이틀 화면에도 Novex Client 버튼이 있습니다."],
  ["Right Shift", "右 Shift", "Mayús derecha", "Maj droite", "Rechte Umschalttaste", "Shift direito", "Правый Shift", "右 Shift", "오른쪽 Shift"],
  ["Novex Client is on for {name}.", "已为 {name} 开启 Novex Client。", "Novex Client está activado en {name}.", "Novex Client est activé pour {name}.", "Novex Client ist für {name} an.", "O Novex Client está ativado em {name}.", "Novex Client включён для {name}.", "{name} で Novex Client をオンにしました。", "{name}에서 Novex Client를 켰습니다."],
  ["Novex Client is off for {name}.", "已为 {name} 关闭 Novex Client。", "Novex Client está desactivado en {name}.", "Novex Client est désactivé pour {name}.", "Novex Client ist für {name} aus.", "O Novex Client está desativado em {name}.", "Novex Client выключен для {name}.", "{name} で Novex Client をオフにしました。", "{name}에서 Novex Client를 껐습니다."],

  // Settings
  ["Account", "账户", "Cuenta", "Compte", "Konto", "Conta", "Аккаунт", "アカウント", "계정"],
  ["Not signed in", "未登录", "Sin sesión iniciada", "Non connecté", "Nicht angemeldet", "Não conectado", "Вход не выполнен", "未サインイン", "로그인 안 됨"],
  ["Playing as this account", "正在使用此账户游戏", "Juegas con esta cuenta", "Vous jouez avec ce compte", "Du spielst mit diesem Konto", "Jogando com esta conta", "Игра с этого аккаунта", "このアカウントでプレイ中", "이 계정으로 플레이 중"],
  ["Manage", "管理", "Gestionar", "Gérer", "Verwalten", "Gerenciar", "Управлять", "管理", "관리"],
  ["Java", "Java", "Java", "Java", "Java", "Java", "Java", "Java", "Java"],
  ["Available in the desktop app.", "在桌面应用中可用。", "Disponible en la aplicación de escritorio.", "Disponible dans l'application de bureau.", "In der Desktop-App verfügbar.", "Disponível no app para computador.", "Доступно в настольном приложении.", "デスクトップアプリで利用できます。", "데스크톱 앱에서 사용할 수 있습니다."],
  ["Memory", "内存", "Memoria", "Mémoire", "Arbeitsspeicher", "Memória", "Память", "メモリ", "메모리"],
  ["Maximum RAM for the game. 4–6 GB suits most vanilla play.", "游戏可用的最大内存。原版游戏一般 4–6 GB 即可。", "RAM máxima para el juego. 4–6 GB bastan para la mayoría de partidas vanilla.", "RAM maximale pour le jeu. 4 à 6 Go conviennent à la plupart des parties vanilla.", "Maximaler Arbeitsspeicher für das Spiel. 4–6 GB reichen für die meisten Vanilla-Runden.", "RAM máxima para o jogo. 4–6 GB servem para a maioria das partidas vanilla.", "Максимум ОЗУ для игры. Для ванильной игры обычно хватает 4–6 ГБ.", "ゲームに割り当てる最大メモリ。バニラなら 4〜6 GB で十分です。", "게임에 쓸 최대 RAM입니다. 바닐라는 보통 4–6 GB면 충분합니다."],
  ["Maximum memory", "最大内存", "Memoria máxima", "Mémoire maximale", "Maximaler Speicher", "Memória máxima", "Максимум памяти", "最大メモリ", "최대 메모리"],
  ["Java executable", "Java 可执行文件", "Ejecutable de Java", "Exécutable Java", "Java-Programm", "Executável do Java", "Исполняемый файл Java", "Java 実行ファイル", "Java 실행 파일"],
  ["Leave empty to use the Java that Novex downloads.", "留空则使用 Novex 下载的 Java。", "Déjalo vacío para usar el Java que descarga Novex.", "Laissez vide pour utiliser le Java téléchargé par Novex.", "Leer lassen, um das von Novex geladene Java zu nutzen.", "Deixe vazio para usar o Java que o Novex baixa.", "Оставьте пустым, чтобы использовать Java, которую скачивает Novex.", "空欄にすると Novex がダウンロードする Java を使います。", "비워 두면 Novex가 내려받는 Java를 사용합니다."],
  ["Automatic", "自动", "Automático", "Automatique", "Automatisch", "Automático", "Автоматически", "自動", "자동"],
  ["JVM arguments", "JVM 参数", "Argumentos de la JVM", "Arguments JVM", "JVM-Argumente", "Argumentos da JVM", "Аргументы JVM", "JVM 引数", "JVM 인수"],
  ["Extra flags passed to Java.", "传给 Java 的额外参数。", "Opciones extra que se pasan a Java.", "Options supplémentaires transmises à Java.", "Zusätzliche Optionen für Java.", "Opções extras passadas ao Java.", "Дополнительные флаги для Java.", "Java に渡す追加のフラグです。", "Java에 전달할 추가 플래그입니다."],
  ["Updates", "更新", "Actualizaciones", "Mises à jour", "Updates", "Atualizações", "Обновления", "アップデート", "업데이트"],
  ["This build wasn't given a GitHub repository to update from.", "此版本没有设置用于更新的 GitHub 仓库。", "Esta compilación no tiene un repositorio de GitHub del que actualizarse.", "Cette version n'a pas de dépôt GitHub pour se mettre à jour.", "Dieser Build hat kein GitHub-Repository für Updates.", "Esta versão não tem um repositório do GitHub para atualizar.", "Для этой сборки не указан репозиторий GitHub для обновлений.", "このビルドには更新元の GitHub リポジトリが設定されていません。", "이 빌드에는 업데이트할 GitHub 저장소가 지정되지 않았습니다."],
  ["Updates come from GitHub and are checked against Novex's signing key.", "更新来自 GitHub，并会用 Novex 的签名密钥校验。", "Las actualizaciones vienen de GitHub y se verifican con la clave de firma de Novex.", "Les mises à jour viennent de GitHub et sont vérifiées avec la clé de signature de Novex.", "Updates kommen von GitHub und werden mit dem Signaturschlüssel von Novex geprüft.", "As atualizações vêm do GitHub e são verificadas com a chave de assinatura do Novex.", "Обновления загружаются с GitHub и проверяются ключом подписи Novex.", "アップデートは GitHub から取得し、Novex の署名鍵で検証します。", "업데이트는 GitHub에서 받고 Novex 서명 키로 확인합니다."],
  ["Update and restart", "更新并重启", "Actualizar y reiniciar", "Mettre à jour et redémarrer", "Aktualisieren und neu starten", "Atualizar e reiniciar", "Обновить и перезапустить", "更新して再起動", "업데이트 후 다시 시작"],
  ["Update interface", "更新界面", "Actualizar interfaz", "Mettre à jour l'interface", "Oberfläche aktualisieren", "Atualizar interface", "Обновить интерфейс", "インターフェースを更新", "인터페이스 업데이트"],
  ["Checking…", "正在检查…", "Comprobando…", "Vérification…", "Wird geprüft…", "Verificando…", "Проверка…", "確認中…", "확인하는 중…"],
  ["Check for updates", "检查更新", "Buscar actualizaciones", "Rechercher des mises à jour", "Nach Updates suchen", "Procurar atualizações", "Проверить обновления", "アップデートを確認", "업데이트 확인"],
  ["Interface", "界面", "Interfaz", "Interface", "Oberfläche", "Interface", "Интерфейс", "インターフェース", "인터페이스"],
  ["Small fixes can arrive without reinstalling. They need the same signing key.", "小修复无需重新安装即可送达，但需要相同的签名密钥。", "Los arreglos pequeños llegan sin reinstalar. Necesitan la misma clave de firma.", "Les petits correctifs arrivent sans réinstaller. Ils nécessitent la même clé de signature.", "Kleine Korrekturen kommen ohne Neuinstallation. Sie brauchen denselben Signaturschlüssel.", "Pequenas correções chegam sem reinstalar. Elas precisam da mesma chave de assinatura.", "Мелкие исправления приходят без переустановки. Им нужен тот же ключ подписи.", "小さな修正は再インストールなしで届きます。同じ署名鍵が必要です。", "작은 수정은 다시 설치하지 않고 받을 수 있습니다. 같은 서명 키가 필요합니다."],
  ["Built in", "内置", "Integrada", "Intégrée", "Eingebaut", "Integrada", "Встроенный", "内蔵", "기본 제공"],
  ["Check automatically", "自动检查", "Comprobar automáticamente", "Vérifier automatiquement", "Automatisch prüfen", "Verificar automaticamente", "Проверять автоматически", "自動で確認", "자동 확인"],
  ["Look for updates each time Novex starts.", "每次启动 Novex 时检查更新。", "Busca actualizaciones cada vez que se inicia Novex.", "Recherche des mises à jour à chaque lancement de Novex.", "Bei jedem Start von Novex nach Updates suchen.", "Procura atualizações sempre que o Novex inicia.", "Искать обновления при каждом запуске Novex.", "Novex の起動ごとにアップデートを確認します。", "Novex를 시작할 때마다 업데이트를 확인합니다."],
  ["Check for updates automatically", "自动检查更新", "Buscar actualizaciones automáticamente", "Rechercher les mises à jour automatiquement", "Automatisch nach Updates suchen", "Procurar atualizações automaticamente", "Автоматически проверять обновления", "アップデートを自動で確認", "업데이트 자동 확인"],
  ["Content sources", "内容来源", "Fuentes de contenido", "Sources de contenu", "Inhaltsquellen", "Fontes de conteúdo", "Источники контента", "コンテンツの取得元", "콘텐츠 소스"],
  ["Modrinth", "Modrinth", "Modrinth", "Modrinth", "Modrinth", "Modrinth", "Modrinth", "Modrinth", "Modrinth"],
  ["Works without setup.", "无需设置即可使用。", "Funciona sin configurar nada.", "Fonctionne sans configuration.", "Funktioniert ohne Einrichtung.", "Funciona sem configurar.", "Работает без настройки.", "設定なしで使えます。", "설정 없이 작동합니다."],
  ["Ready", "就绪", "Listo", "Prêt", "Bereit", "Pronto", "Готово", "準備完了", "준비됨"],
  ["CurseForge API key", "CurseForge API 密钥", "Clave de API de CurseForge", "Clé d'API CurseForge", "CurseForge-API-Schlüssel", "Chave de API do CurseForge", "API-ключ CurseForge", "CurseForge API キー", "CurseForge API 키"],
  ["Create a free key at console.curseforge.com, then paste it here.", "在 console.curseforge.com 免费创建密钥，然后粘贴到这里。", "Crea una clave gratuita en console.curseforge.com y pégala aquí.", "Créez une clé gratuite sur console.curseforge.com, puis collez-la ici.", "Erstelle auf console.curseforge.com einen kostenlosen Schlüssel und füge ihn hier ein.", "Crie uma chave grátis em console.curseforge.com e cole aqui.", "Создайте бесплатный ключ на console.curseforge.com и вставьте его сюда.", "console.curseforge.com で無料のキーを作成し、ここに貼り付けます。", "console.curseforge.com에서 무료 키를 만들어 여기에 붙여 넣으세요."],
  ["Not set", "未设置", "Sin configurar", "Non définie", "Nicht festgelegt", "Não definida", "Не задан", "未設定", "설정 안 됨"],
  ["Hide", "隐藏", "Ocultar", "Masquer", "Ausblenden", "Ocultar", "Скрыть", "隠す", "숨기기"],
  ["Show", "显示", "Mostrar", "Afficher", "Anzeigen", "Mostrar", "Показать", "表示", "보기"],
  ["Appearance", "外观", "Apariencia", "Apparence", "Darstellung", "Aparência", "Оформление", "外観", "모양"],
  ["Theme", "主题", "Tema", "Thème", "Design", "Tema", "Тема", "テーマ", "테마"],
  ["PCL and Prism are flat; the others use liquid-glass panels.", "PCL 和 Prism 为扁平风格，其他主题使用液态玻璃面板。", "PCL y Prism son planos; los demás usan paneles de vidrio líquido.", "PCL et Prism sont plats ; les autres utilisent des panneaux de verre liquide.", "PCL und Prism sind flach, die anderen nutzen Flüssigglas-Flächen.", "PCL e Prism são planos; os outros usam painéis de vidro líquido.", "PCL и Prism плоские, остальные используют панели из «жидкого стекла».", "PCL と Prism はフラット、それ以外はリキッドグラスのパネルです。", "PCL과 Prism은 평면이고, 나머지는 리퀴드 글래스 패널을 씁니다."],
  ["Mode", "模式", "Modo", "Mode", "Modus", "Modo", "Режим", "モード", "모드"],
  ["Dark", "深色", "Oscuro", "Sombre", "Dunkel", "Escuro", "Тёмный", "ダーク", "어둡게"],
  ["Light theme", "浅色", "Claro", "Clair", "Hell", "Claro", "Светлый", "ライト", "밝게"],
  ["System", "跟随系统", "Sistema", "Système", "System", "Sistema", "Системный", "システム", "시스템"],
  ["Language", "语言", "Idioma", "Langue", "Sprache", "Idioma", "Язык", "言語", "언어"],
  ["Changes the launcher's language. Minecraft keeps its own language setting.", "更改启动器的语言。Minecraft 的语言设置保持不变。", "Cambia el idioma del launcher. Minecraft mantiene su propio ajuste de idioma.", "Change la langue du launcher. Minecraft garde son propre réglage de langue.", "Ändert die Sprache des Launchers. Minecraft behält seine eigene Spracheinstellung.", "Muda o idioma do launcher. O Minecraft mantém a própria configuração de idioma.", "Меняет язык лаунчера. У Minecraft остаётся своя настройка языка.", "ランチャーの言語を変更します。Minecraft の言語設定は変わりません。", "런처 언어를 바꿉니다. Minecraft는 자체 언어 설정을 유지합니다."],
  ["Match system", "跟随系统", "Igual que el sistema", "Comme le système", "Wie das System", "Igual ao sistema", "Как в системе", "システムに合わせる", "시스템 설정 따르기"],
  ["About", "关于", "Acerca de", "À propos", "Über", "Sobre", "О программе", "情報", "정보"],
  ["Version", "版本", "Versión", "Version", "Version", "Versão", "Версия", "バージョン", "버전"],
  ["Platform", "平台", "Plataforma", "Plateforme", "Plattform", "Plataforma", "Платформа", "プラットフォーム", "플랫폼"],
  ["Browser preview", "浏览器预览", "Vista previa en el navegador", "Aperçu dans le navigateur", "Browser-Vorschau", "Prévia no navegador", "Предпросмотр в браузере", "ブラウザプレビュー", "브라우저 미리보기"],
  ["Data folder", "数据文件夹", "Carpeta de datos", "Dossier de données", "Datenordner", "Pasta de dados", "Папка данных", "データフォルダ", "데이터 폴더"],
  ["Instances, Java runtimes and settings live here.", "实例、Java 运行时和设置都保存在这里。", "Aquí se guardan las instancias, los runtimes de Java y los ajustes.", "Les instances, les runtimes Java et les réglages sont stockés ici.", "Hier liegen Instanzen, Java-Laufzeiten und Einstellungen.", "Aqui ficam as instâncias, os runtimes do Java e as configurações.", "Здесь хранятся сборки, среды Java и настройки.", "インスタンス、Java ランタイム、設定はここに保存されます。", "인스턴스, Java 런타임, 설정이 여기에 저장됩니다."],
  // Live session
  ["Preparing", "准备中", "Preparando", "Préparation", "Vorbereitung", "Preparando", "Подготовка", "準備中", "준비 중"],
  ["Loading game", "加载游戏", "Cargando el juego", "Chargement du jeu", "Spiel lädt", "Carregando o jogo", "Загрузка игры", "ゲームを読み込み中", "게임 불러오는 중"],
  ["In menus", "菜单中", "En los menús", "Dans les menus", "Im Menü", "Nos menus", "В меню", "メニュー", "메뉴"],
  ["Joining world", "进入世界", "Entrando al mundo", "Connexion au monde", "Welt wird betreten", "Entrando no mundo", "Вход в мир", "ワールドに参加中", "월드 입장 중"],
  ["Playing", "游戏中", "Jugando", "En jeu", "Im Spiel", "Jogando", "В игре", "プレイ中", "플레이 중"],
  ["Saving", "保存中", "Guardando", "Sauvegarde", "Speichert", "Salvando", "Сохранение", "保存中", "저장 중"],
  ["Closing", "正在关闭", "Cerrando", "Fermeture", "Wird beendet", "Fechando", "Закрытие", "終了中", "종료 중"],
  ["Starting", "启动中", "Iniciando", "Démarrage", "Startet", "Iniciando", "Запуск", "起動中", "시작 중"],
  ["Loading", "加载中", "Cargando", "Chargement", "Lädt", "Carregando", "Загрузка", "読み込み中", "불러오는 중"],
  ["Menu", "菜单", "Menú", "Menu", "Menü", "Menu", "Меню", "メニュー", "메뉴"],
  ["Joining", "进入中", "Entrando", "Connexion", "Betritt", "Entrando", "Вход", "参加中", "입장 중"],
  ["Checking files, Java and your account.", "正在检查文件、Java 和账户。", "Comprobando archivos, Java y tu cuenta.", "Vérification des fichiers, de Java et de votre compte.", "Dateien, Java und dein Konto werden geprüft.", "Verificando arquivos, Java e sua conta.", "Проверка файлов, Java и аккаунта.", "ファイル、Java、アカウントを確認しています。", "파일, Java, 계정을 확인하는 중입니다."],
  ["Minecraft is starting and loading resources.", "Minecraft 正在启动并加载资源。", "Minecraft se está iniciando y cargando recursos.", "Minecraft démarre et charge ses ressources.", "Minecraft startet und lädt Ressourcen.", "O Minecraft está iniciando e carregando recursos.", "Minecraft запускается и загружает ресурсы.", "Minecraft を起動してリソースを読み込んでいます。", "Minecraft를 시작하고 리소스를 불러오는 중입니다."],
  ["On the title screen or in a menu.", "在标题画面或菜单中。", "En la pantalla de título o en un menú.", "Sur l'écran titre ou dans un menu.", "Im Titelbildschirm oder in einem Menü.", "Na tela inicial ou em um menu.", "На главном экране или в меню.", "タイトル画面かメニューにいます。", "타이틀 화면이나 메뉴에 있습니다."],
  ["Loading a world or connecting to a server.", "正在加载世界或连接服务器。", "Cargando un mundo o conectando a un servidor.", "Chargement d'un monde ou connexion à un serveur.", "Eine Welt lädt oder ein Server wird verbunden.", "Carregando um mundo ou conectando a um servidor.", "Загрузка мира или подключение к серверу.", "ワールドを読み込むか、サーバーに接続しています。", "월드를 불러오거나 서버에 연결하는 중입니다."],
  ["In a world.", "在世界中。", "En un mundo.", "Dans un monde.", "In einer Welt.", "Em um mundo.", "В мире.", "ワールドにいます。", "월드에 있습니다."],
  ["Writing the world to disk. Wait before closing the game.", "正在把世界写入磁盘。请等待完成后再关闭游戏。", "Guardando el mundo en el disco. Espera antes de cerrar el juego.", "Écriture du monde sur le disque. Attendez avant de fermer le jeu.", "Die Welt wird gespeichert. Warte, bevor du das Spiel schließt.", "Gravando o mundo no disco. Espere antes de fechar o jogo.", "Мир записывается на диск. Подождите, прежде чем закрывать игру.", "ワールドを保存しています。ゲームを閉じるのは少し待ってください。", "월드를 디스크에 저장하는 중입니다. 게임을 닫기 전에 기다려 주세요."],
  ["Saving and shutting down.", "正在保存并关闭。", "Guardando y cerrando.", "Sauvegarde et fermeture.", "Speichert und beendet.", "Salvando e encerrando.", "Сохранение и выход.", "保存して終了しています。", "저장 후 종료하는 중입니다."],
  ["Progress", "进度", "Progreso", "Progression", "Fortschritt", "Progresso", "Прогресс", "進行状況", "진행 상황"],
  ["of {max} GB", "共 {max} GB", "de {max} GB", "sur {max} Go", "von {max} GB", "de {max} GB", "из {max} ГБ", "{max} GB 中", "{max}GB 중"],
  ["Not reported here", "此系统不提供", "No disponible aquí", "Non disponible ici", "Hier nicht verfügbar", "Não disponível aqui", "Здесь недоступно", "このシステムでは取得できません", "여기서는 확인할 수 없음"],
  ["Whole system", "整个系统", "Todo el sistema", "Tout le système", "Ganzes System", "Sistema inteiro", "Вся система", "システム全体", "시스템 전체"],
  ["On", "开启", "Activado", "Activé", "An", "Ativado", "Вкл.", "オン", "켜짐"],
  ["Off", "关闭", "Desactivado", "Désactivé", "Aus", "Desativado", "Выкл.", "オフ", "꺼짐"],
  ["Not available", "不可用", "No disponible", "Indisponible", "Nicht verfügbar", "Indisponível", "Недоступно", "利用不可", "사용할 수 없음"],
  ["Right Shift opens its menu in game.", "游戏中按右 Shift 打开菜单。", "Mayús derecha abre su menú en el juego.", "Maj droite ouvre son menu en jeu.", "Die rechte Umschalttaste öffnet im Spiel das Menü.", "Shift direito abre o menu no jogo.", "Правый Shift открывает меню в игре.", "ゲーム中は右 Shift でメニューを開けます。", "게임에서 오른쪽 Shift로 메뉴를 엽니다."],
  ["Turn it on to add the HUD to this instance.", "开启后可为此实例添加 HUD。", "Actívalo para añadir el HUD a esta instancia.", "Activez-le pour ajouter le HUD à cette instance.", "Schalte es ein, um dieser Instanz das HUD hinzuzufügen.", "Ative para adicionar o HUD a esta instância.", "Включите, чтобы добавить HUD в эту сборку.", "オンにするとこのインスタンスに HUD が追加されます。", "켜면 이 인스턴스에 HUD가 추가됩니다."],
  ["Open Novex Client", "打开 Novex Client", "Abrir Novex Client", "Ouvrir Novex Client", "Novex Client öffnen", "Abrir o Novex Client", "Открыть Novex Client", "Novex Client を開く", "Novex Client 열기"],
  ["Files", "文件", "Archivos", "Fichiers", "Dateien", "Arquivos", "Файлы", "ファイル", "파일"],

  // Game settings
  ["Game settings", "游戏设置", "Ajustes del juego", "Paramètres du jeu", "Spieleinstellungen", "Configurações do jogo", "Настройки игры", "ゲーム設定", "게임 설정"],
  ["Unlimited", "无限制", "Ilimitado", "Illimité", "Unbegrenzt", "Ilimitado", "Без ограничения", "無制限", "무제한"],
  ["VSync", "垂直同步", "VSync", "VSync", "VSync", "VSync", "Вертикальная синхронизация", "VSync", "수직 동기화"],
  ["Fullscreen", "全屏", "Pantalla completa", "Plein écran", "Vollbild", "Tela cheia", "Полноэкранный режим", "フルスクリーン", "전체 화면"],
  ["Auto", "自动", "Auto", "Auto", "Auto", "Auto", "Авто", "自動", "자동"],
  ["Brightness", "亮度", "Brillo", "Luminosité", "Helligkeit", "Brilho", "Яркость", "明るさ", "밝기"],
  ["Moody", "昏暗", "Oscuro", "Sombre", "Düster", "Escuro", "Мрачно", "暗い", "어둡게"],
  ["Bright", "明亮", "Brillante", "Lumineux", "Hell", "Claro", "Ярко", "明るい", "밝게"],
  ["Normal", "正常", "Normal", "Normal", "Normal", "Normal", "Обычное", "標準", "보통"],
  ["Particles", "粒子效果", "Partículas", "Particules", "Partikel", "Partículas", "Частицы", "パーティクル", "입자"],
  ["All", "全部", "Todas", "Toutes", "Alle", "Todas", "Все", "すべて", "모두"],
  ["Decreased", "减少", "Reducidas", "Réduites", "Verringert", "Reduzidas", "Меньше", "少なめ", "감소"],
  ["Minimal", "最少", "Mínimas", "Minimales", "Minimal", "Mínimas", "Минимум", "最小", "최소"],
  ["New instances will start with {name}'s settings.", "新实例将使用 {name} 的设置。", "Las nuevas instancias empezarán con los ajustes de {name}.", "Les nouvelles instances démarreront avec les paramètres de {name}.", "Neue Instanzen starten mit den Einstellungen von {name}.", "Novas instâncias vão começar com as configurações de {name}.", "Новые сборки будут начинаться с настроек {name}.", "新しいインスタンスは {name} の設定で始まります。", "새 인스턴스는 {name}의 설정으로 시작합니다."],
  ["Copies an instance's keybinds and every game setting into instances that haven't been played yet. Keybinds changed format in 1.13, so a template only goes to instances on the same side of it.", "把某个实例的按键绑定和所有游戏设置复制到还没玩过的实例。按键格式在 1.13 改变过，所以模板只会用于 1.13 同一侧的实例。", "Copia los controles y todos los ajustes del juego de una instancia a las que aún no se han jugado. El formato de los controles cambió en la 1.13, así que una plantilla solo se aplica a instancias del mismo lado.", "Copie les touches et tous les paramètres du jeu d'une instance dans celles qui n'ont pas encore été jouées. Le format des touches a changé en 1.13 : un modèle ne s'applique qu'aux instances du même côté.", "Kopiert Tastenbelegung und alle Spieleinstellungen einer Instanz in Instanzen, die noch nicht gespielt wurden. Das Tastenformat hat sich mit 1.13 geändert, daher gilt eine Vorlage nur für Instanzen auf derselben Seite.", "Copia os controles e todas as configurações do jogo de uma instância para as que ainda não foram jogadas. O formato dos controles mudou na 1.13, então um modelo só vale para instâncias do mesmo lado.", "Копирует раскладку клавиш и все настройки игры одной сборки в сборки, которые ещё не запускались. Формат клавиш изменился в 1.13, поэтому шаблон применяется только к сборкам по ту же сторону.", "あるインスタンスのキー設定とすべてのゲーム設定を、まだ遊んでいないインスタンスにコピーします。キー設定の形式は 1.13 で変わったため、テンプレートは同じ側のインスタンスにだけ使われます。", "인스턴스의 키 설정과 모든 게임 설정을 아직 플레이하지 않은 인스턴스에 복사합니다. 키 설정 형식이 1.13에서 바뀌어서 템플릿은 같은 쪽 인스턴스에만 적용됩니다."],
  ["Include mod settings", "包含模组设置", "Incluir ajustes de mods", "Inclure les réglages des mods", "Mod-Einstellungen einschließen", "Incluir configurações de mods", "Включить настройки модов", "MOD の設定を含める", "모드 설정 포함"],
  ["Replace template", "替换模板", "Reemplazar plantilla", "Remplacer le modèle", "Vorlage ersetzen", "Substituir modelo", "Заменить шаблон", "テンプレートを置き換え", "템플릿 바꾸기"],
  ["Use as template", "用作模板", "Usar como plantilla", "Utiliser comme modèle", "Als Vorlage verwenden", "Usar como modelo", "Использовать как шаблон", "テンプレートにする", "템플릿으로 사용"],
  ["Create and play an instance first.", "请先创建并玩一次某个实例。", "Primero crea una instancia y juega con ella.", "Créez d'abord une instance et jouez-y.", "Erstelle und spiele zuerst eine Instanz.", "Primeiro crie uma instância e jogue nela.", "Сначала создайте сборку и поиграйте в неё.", "まずインスタンスを作成して一度遊んでください。", "먼저 인스턴스를 만들고 한 번 플레이하세요."],
  ["Use the launcher's game settings", "使用启动器的游戏设置", "Usar los ajustes del juego del launcher", "Utiliser les paramètres de jeu du launcher", "Spieleinstellungen des Launchers verwenden", "Usar as configurações de jogo do launcher", "Использовать настройки игры из лаунчера", "ランチャーのゲーム設定を使う", "런처의 게임 설정 사용"],
  ["Off keeps this instance's own options as they are.", "关闭后保留此实例自己的设置。", "Desactivado conserva los ajustes propios de esta instancia.", "Désactivé, cette instance garde ses propres réglages.", "Aus behält die eigenen Einstellungen dieser Instanz.", "Desativado mantém as configurações próprias desta instância.", "Если выключено, у сборки остаются свои настройки.", "オフにすると、このインスタンス独自の設定のままです。", "끄면 이 인스턴스의 자체 설정을 그대로 유지합니다."],
  // Game settings tab (Minecraft's own names where it has them)
  ["Skin Customization", "皮肤自定义", "Personalización del aspecto", "Personnalisation du skin", "Skin-Anpassung", "Personalização da skin", "Настройки скина", "スキンのカスタマイズ", "스킨 사용자 지정"],
  ["Music & Sounds", "音乐和声音", "Música y sonidos", "Musique et sons", "Musik & Geräusche", "Música e sons", "Музыка и звуки", "音楽と音声", "음악 및 소리"],
  ["Video Settings", "视频设置", "Gráficos", "Paramètres vidéo", "Grafikeinstellungen", "Configurações de vídeo", "Настройки графики", "ビデオ設定", "비디오 설정"],
  ["Controls", "控制", "Controles", "Commandes", "Steuerung", "Controles", "Управление", "操作設定", "조작"],
  ["Chat Settings", "聊天设置", "Chat", "Paramètres du tchat", "Chateinstellungen", "Configurações do chat", "Настройки чата", "チャット設定", "채팅 설정"],
  ["Key Binds", "按键绑定", "Controles", "Contrôles", "Tastenbelegung", "Controles", "Управление", "キー割り当て", "조작 키 설정"],
  ["Accessibility Settings", "无障碍设置", "Accesibilidad", "Accessibilité", "Barrierefreiheit", "Acessibilidade", "Специальные возможности", "アクセシビリティ設定", "접근성 설정"],
  ["All versions", "所有版本", "Todas las versiones", "Toutes les versions", "Alle Versionen", "Todas as versões", "Все версии", "全バージョン", "모든 버전"],
  ["Reset section", "重置此部分", "Restablecer sección", "Réinitialiser la section", "Bereich zurücksetzen", "Redefinir seção", "Сбросить раздел", "このセクションをリセット", "섹션 초기화"],
  ["Other", "其他", "Otros", "Autres", "Sonstiges", "Outros", "Прочее", "その他", "기타"],
  ["Multiplayer Settings", "多人游戏设置", "Ajustes de multijugador", "Paramètres multijoueur", "Mehrspieler-Einstellungen", "Configurações de multijogador", "Настройки сетевой игры", "マルチプレイ設定", "멀티플레이어 설정"],
  ["Used on 1.8 instances, over the All versions page. Anything you leave alone comes from there. Right-click to reset.", "用于 1.8 实例，优先于“所有版本”页面。未更改的选项沿用该页面。右键单击可重置。", "Se usa en instancias 1.8, por encima de Todas las versiones. Lo que no cambies viene de allí. Clic derecho para restablecer.", "Utilisé sur les instances 1.8, en priorité sur la page Toutes les versions. Ce que vous ne changez pas vient de là. Clic droit pour réinitialiser.", "Gilt für 1.8-Instanzen und hat Vorrang vor „Alle Versionen“. Was du nicht änderst, kommt von dort. Rechtsklick zum Zurücksetzen.", "Usado em instâncias 1.8, acima da página Todas as versões. O que você não alterar vem de lá. Clique direito para redefinir.", "Для экземпляров 1.8, важнее страницы «Все версии». Всё, что вы не меняли, берётся оттуда. Правый клик сбрасывает.", "1.8 のインスタンスで「全バージョン」より優先されます。変更しない項目はそちらの値を使います。右クリックでリセット。", "1.8 인스턴스에서 '모든 버전'보다 우선합니다. 바꾸지 않은 항목은 그쪽 값을 씁니다. 우클릭으로 초기화합니다."],
  ["Done", "完成", "Listo", "Terminé", "Fertig", "Concluído", "Готово", "完了", "완료"],
  ["Movement", "移动", "Movimiento", "Mouvement", "Bewegung", "Movimento", "Движение", "移動", "이동"],
  ["Gameplay", "游戏内容", "Jugabilidad", "Jouabilité", "Spielmechanik", "Jogabilidade", "Игровой процесс", "ゲームプレイ", "게임플레이"],
  ["Inventory", "物品栏", "Inventario", "Inventaire", "Inventar", "Inventário", "Инвентарь", "インベントリ", "보관함"],
  ["Creative Mode", "创造模式", "Modo creativo", "Mode Créatif", "Kreativmodus", "Modo Criativo", "Творческий режим", "クリエイティブモード", "크리에이티브 모드"],
  ["Multiplayer", "多人游戏", "Multijugador", "Multijoueur", "Mehrspieler", "Multijogador", "Сетевая игра", "マルチプレイ", "멀티플레이"],
  ["Miscellaneous", "杂项", "Miscelánea", "Divers", "Sonstiges", "Diversos", "Разное", "その他", "기타"],
  ["Copy from Instance", "从实例复制", "Copiar de una instancia", "Copier depuis une instance", "Von Instanz kopieren", "Copiar de uma instância", "Копировать из сборки", "インスタンスからコピー", "인스턴스에서 복사"],
  ["Written into every instance before it launches, so new ones play the same. Options you haven't changed stay as each instance has them. Sodium and other performance mods use these too.", "启动前写入每个实例，让新实例手感一致。没改过的选项会保留各实例自己的值。Sodium 等性能模组也使用这些设置。", "Se escriben en cada instancia antes de iniciarla, para que las nuevas se jueguen igual. Las opciones que no cambies se quedan como las tenga cada instancia. Sodium y otros mods de rendimiento también las usan.", "Écrits dans chaque instance avant son lancement, pour que les nouvelles se jouent pareil. Les options non modifiées restent celles de chaque instance. Sodium et les autres mods de performance les utilisent aussi.", "Wird vor jedem Start in jede Instanz geschrieben, damit sich neue gleich spielen. Nicht geänderte Optionen bleiben, wie jede Instanz sie hat. Sodium und andere Performance-Mods nutzen sie auch.", "Gravadas em cada instância antes de iniciar, para que as novas joguem igual. Opções que você não mudou ficam como cada instância tem. O Sodium e outros mods de desempenho também as usam.", "Записываются в каждую сборку перед запуском, чтобы новые играли так же. Неизменённые параметры остаются как в каждой сборке. Sodium и другие моды производительности тоже их используют.", "起動前に各インスタンスへ書き込むので、新しいインスタンスも同じ感覚で遊べます。変更していない項目は各インスタンスの値のままです。Sodium などのパフォーマンス MOD もこれを使います。", "실행 전에 모든 인스턴스에 기록되어 새 인스턴스도 같은 느낌으로 플레이할 수 있습니다. 바꾸지 않은 옵션은 각 인스턴스의 값 그대로입니다. Sodium 등 성능 모드도 이 설정을 사용합니다."],
  ["Stop using {name}", "停止使用 {name}", "Dejar de usar {name}", "Ne plus utiliser {name}", "{name} nicht mehr verwenden", "Parar de usar {name}", "Не использовать {name}", "{name} の使用をやめる", "{name} 사용 중지"],
  ["Instance", "实例", "Instancia", "Instance", "Instanz", "Instância", "Сборка", "インスタンス", "인스턴스"],
  // Launch stages, sent by the backend and translated where they are shown.
  ["Signing in", "正在登录", "Iniciando sesión", "Connexion", "Anmeldung", "Entrando", "Вход в аккаунт", "サインイン中", "로그인 중"],
];

const dict = new Map<string, string[]>(rows.map((r) => [r[0], r]));

let current: Language = "en";

/** Picks the closest supported language for a BCP 47 tag like "zh-CN" or "pt-BR". */
export function resolveLanguage(pref: LanguagePref): Language {
  if (pref !== "system") return pref;
  const tag = (navigator.language || "en").toLowerCase().split("-")[0];
  return (order as string[]).includes(tag) ? (tag as Language) : "en";
}

export function setLanguage(lang: Language) {
  current = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
}

/** Translates an English UI string, filling {name} placeholders. Unknown strings come back in English. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const row = dict.get(en);
  let s = (row && row[order.indexOf(current)]) || en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Like t(), but placeholders can be elements, e.g. a <kbd> inside a sentence. */
export function tNode(en: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = t(en).split(/(\{\w+\})/);
  return createElement(
    Fragment,
    null,
    ...parts.map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      return m && m[1] in nodes ? nodes[m[1]] : p;
    }),
  );
}
