using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using IlluvrseWrestling.Core;
using IlluvrseWrestling.Data;
using IlluvrseWrestling.Combat;
using IlluvrseWrestling.AI;
using IlluvrseWrestling.UI;
using IlluvrseWrestling.Utilities;

public static class ILLUVRSEProjectGenerator
{
    const string ResourcesPath = "Assets/Resources";
    const string WrestlerPath = "Assets/Resources/Wrestlers";
    const string PrefabPath = "Assets/Prefabs";
    const string ScenePath = "Assets/Scenes";
    const string MaterialPath = "Assets/Materials";

    [MenuItem("Tools/ILLUVRSE/Generate All")]
    public static void GenerateAll()
    {
        if (UnityEditor.EditorApplication.isPlayingOrWillChangePlaymode)
        {
            UnityEditor.EditorApplication.isPlaying = false;
            UnityEditor.EditorApplication.delayCall += GenerateAll;
            return;
        }

        if (UnityEditor.EditorApplication.isCompiling)
        {
            UnityEditor.EditorApplication.delayCall += GenerateAll;
            return;
        }

        EnsureFolders();
        EnsureTags();
        GameSettings settings = CreateSettings();
        List<WrestlerData> roster = CreateWrestlers();
        CreateRosterDatabase(roster);
        CreatePrefabs(settings);
        CreateScenes(settings);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("ILLUVRSE Wrestling: Generated assets, prefabs, scenes.");
    }

    static void EnsureFolders()
    {
        string[] paths = { ResourcesPath, WrestlerPath, PrefabPath, ScenePath, MaterialPath };
        for (int i = 0; i < paths.Length; i++)
        {
            if (!AssetDatabase.IsValidFolder(paths[i]))
            {
                string parent = System.IO.Path.GetDirectoryName(paths[i]);
                string leaf = System.IO.Path.GetFileName(paths[i]);
                AssetDatabase.CreateFolder(parent, leaf);
            }
        }
    }

    static void EnsureTags()
    {
        SerializedObject tagManager = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);
        SerializedProperty tagsProp = tagManager.FindProperty("tags");
        AddTagIfMissing(tagsProp, "Player1");
        AddTagIfMissing(tagsProp, "Player2");
        tagManager.ApplyModifiedProperties();
    }

    static void AddTagIfMissing(SerializedProperty tagsProp, string tag)
    {
        for (int i = 0; i < tagsProp.arraySize; i++)
        {
            SerializedProperty t = tagsProp.GetArrayElementAtIndex(i);
            if (t.stringValue == tag)
            {
                return;
            }
        }
        tagsProp.InsertArrayElementAtIndex(tagsProp.arraySize);
        tagsProp.GetArrayElementAtIndex(tagsProp.arraySize - 1).stringValue = tag;
    }

    static GameSettings CreateSettings()
    {
        GameSettings settings = AssetDatabase.LoadAssetAtPath<GameSettings>(ResourcesPath + "/GameSettings.asset");
        if (settings == null)
        {
            settings = ScriptableObject.CreateInstance<GameSettings>();
            AssetDatabase.CreateAsset(settings, ResourcesPath + "/GameSettings.asset");
        }
        return settings;
    }

    static List<WrestlerData> CreateWrestlers()
    {
        List<WrestlerData> roster = new List<WrestlerData>();
        foreach (WrestlerSeed seed in BuildSeeds())
        {
            string path = WrestlerPath + "/" + seed.Id + ".asset";
            WrestlerData data = AssetDatabase.LoadAssetAtPath<WrestlerData>(path);
            if (data == null)
            {
                data = ScriptableObject.CreateInstance<WrestlerData>();
                AssetDatabase.CreateAsset(data, path);
            }
            data.Id = seed.Id;
            data.DisplayName = seed.DisplayName;
            data.Division = seed.Division;
            data.Stats = seed.Stats;
            data.Special = seed.Special;
            data.PrimaryColor = seed.PrimaryColor;
            data.SecondaryColor = seed.SecondaryColor;
            roster.Add(data);
        }
        return roster;
    }

    static void CreateRosterDatabase(List<WrestlerData> roster)
    {
        RosterDatabase db = AssetDatabase.LoadAssetAtPath<RosterDatabase>(ResourcesPath + "/RosterDatabase.asset");
        if (db == null)
        {
            db = ScriptableObject.CreateInstance<RosterDatabase>();
            AssetDatabase.CreateAsset(db, ResourcesPath + "/RosterDatabase.asset");
        }
        db.Wrestlers = roster;
        EditorUtility.SetDirty(db);
    }

    static void CreatePrefabs(GameSettings settings)
    {
        CreateWrestlerPrefab();
        CreateRingPrefab(settings);
        CreateCameraPrefab();
    }

    static void CreateWrestlerPrefab()
    {
        GameObject root = new GameObject("Wrestler");
        Rigidbody rb = root.AddComponent<Rigidbody>();
        rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
        CapsuleCollider capsule = root.AddComponent<CapsuleCollider>();
        capsule.height = 2f;
        capsule.radius = 0.5f;

        GameObject body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        body.name = "Body";
        body.transform.SetParent(root.transform, false);
        body.transform.localPosition = Vector3.zero;
        Object.DestroyImmediate(body.GetComponent<CapsuleCollider>());
        MeshRenderer renderer = body.GetComponent<MeshRenderer>();
        Material mat = new Material(Shader.Find("Standard"));
        renderer.sharedMaterial = mat;

        root.AddComponent<WrestlerController>();
        root.AddComponent<PlayerInputProvider>();
        root.AddComponent<AIController>();
        WrestlerVisuals visuals = root.AddComponent<WrestlerVisuals>();
        visuals.BodyRenderer = renderer;

        string path = PrefabPath + "/Wrestler.prefab";
        PrefabUtility.SaveAsPrefabAsset(root, path);
        Object.DestroyImmediate(root);
    }

    static void CreateRingPrefab(GameSettings settings)
    {
        GameObject root = new GameObject("Ring");
        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        floor.name = "RingFloor";
        floor.transform.SetParent(root.transform, false);
        floor.transform.localScale = new Vector3(settings.RingRadius * 2f, 0.1f, settings.RingRadius * 2f);
        floor.GetComponent<Renderer>().sharedMaterial = CreateMaterial("RingMat", new Color(0.85f, 0.75f, 0.6f));

        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Arena";
        ground.transform.SetParent(root.transform, false);
        ground.transform.localPosition = new Vector3(0f, -0.12f, 0f);
        ground.transform.localScale = new Vector3(2.5f, 1f, 2.5f);
        ground.GetComponent<Renderer>().sharedMaterial = CreateMaterial("ArenaMat", new Color(0.3f, 0.4f, 0.45f));

        RingBoundary boundary = root.AddComponent<RingBoundary>();
        boundary.Radius = settings.RingRadius;

        string path = PrefabPath + "/Ring.prefab";
        PrefabUtility.SaveAsPrefabAsset(root, path);
        Object.DestroyImmediate(root);
    }

    static void CreateCameraPrefab()
    {
        GameObject root = new GameObject("CameraRig");
        Camera camera = root.AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.15f, 0.18f, 0.2f);
        camera.orthographic = true;
        camera.orthographicSize = 6f;
        root.transform.rotation = Quaternion.Euler(35f, 45f, 0f);
        root.transform.position = new Vector3(0f, 8f, -8f);

        root.AddComponent<CameraRig>();

        string path = PrefabPath + "/CameraRig.prefab";
        PrefabUtility.SaveAsPrefabAsset(root, path);
        Object.DestroyImmediate(root);
    }

    static Material CreateMaterial(string name, Color color)
    {
        string path = MaterialPath + "/" + name + ".mat";
        Material mat = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (mat == null)
        {
            mat = new Material(Shader.Find("Standard"));
            AssetDatabase.CreateAsset(mat, path);
        }
        mat.color = color;
        EditorUtility.SetDirty(mat);
        return mat;
    }

    static void CreateScenes(GameSettings settings)
    {
        CreateMainMenuScene();
        CreateCharacterSelectScene();
        CreateMatchScene(settings);
        CreateLadderScene();
    }

    static void CreateMainMenuScene()
    {
        Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        CreateLighting();
        CreateUICamera();
        CreateGameManager();
        CreateAudioManager();

        Canvas canvas = CreateCanvas("MainMenuCanvas");
        CreateTitle(canvas.transform, "ILLUVRSE Wrestling", new Vector2(0, 200));

        GameObject buttons = new GameObject("Buttons");
        buttons.transform.SetParent(canvas.transform, false);
        VerticalLayoutGroup layout = buttons.AddComponent<VerticalLayoutGroup>();
        layout.childAlignment = TextAnchor.MiddleCenter;
        layout.spacing = 16f;
        RectTransform buttonRect = buttons.GetComponent<RectTransform>();
        buttonRect.sizeDelta = new Vector2(300, 300);
        buttonRect.anchoredPosition = new Vector2(0, -40);

        Button play = CreateButton(buttons.transform, "Quick Match");
        Button versus = CreateButton(buttons.transform, "Versus");
        Button ladder = CreateButton(buttons.transform, "Ladder");
        Button options = CreateButton(buttons.transform, "Options");
        Button quit = CreateButton(buttons.transform, "Quit");

        MainMenuUI ui = canvas.gameObject.AddComponent<MainMenuUI>();
        play.onClick.AddListener(ui.PlayQuickMatch);
        versus.onClick.AddListener(ui.PlayVersus);
        ladder.onClick.AddListener(ui.PlayLadder);
        options.onClick.AddListener(ui.ToggleOptions);
        quit.onClick.AddListener(ui.Quit);

        GameObject optionsPanel = CreatePanel(canvas.transform, "OptionsPanel", new Vector2(0, -140), new Vector2(300, 160));
        optionsPanel.SetActive(false);
        CreateLabel(optionsPanel.transform, "OptionsLabel", "Audio: On\nPost FX: Off\nWebGL Safe", new Vector2(0, 10), 18);
        ui.OptionsPanel = optionsPanel;

        SaveScene(scene, ScenePath + "/MainMenu.unity");
    }

    static void CreateCharacterSelectScene()
    {
        Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        CreateLighting();
        CreateUICamera();
        CreateGameManager();
        CreateAudioManager();

        Canvas canvas = CreateCanvas("CharacterSelectCanvas");
        CreateTitle(canvas.transform, "Character Select", new Vector2(0, 240));

        GameObject rosterPanel = CreatePanel(canvas.transform, "RosterPanel", new Vector2(0, 20), new Vector2(420, 360));
        GridLayoutGroup grid = rosterPanel.AddComponent<GridLayoutGroup>();
        grid.cellSize = new Vector2(190, 44);
        grid.spacing = new Vector2(10, 10);
        grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        grid.constraintCount = 2;

        GameObject leftPanel = CreatePanel(canvas.transform, "P1Panel", new Vector2(-380, 20), new Vector2(240, 260));
        GameObject rightPanel = CreatePanel(canvas.transform, "P2Panel", new Vector2(380, 20), new Vector2(240, 260));

        TextMeshProUGUI p1Name = CreateLabel(leftPanel.transform, "P1_NAME", "Player 1", new Vector2(0, 80));
        TextMeshProUGUI p1Stats = CreateLabel(leftPanel.transform, "P1_STATS", "", new Vector2(0, 20));
        TextMeshProUGUI p1Special = CreateLabel(leftPanel.transform, "P1_SPECIAL", "", new Vector2(0, -60), 14);

        TextMeshProUGUI p2Name = CreateLabel(rightPanel.transform, "P2_NAME", "Player 2", new Vector2(0, 80));
        TextMeshProUGUI p2Stats = CreateLabel(rightPanel.transform, "P2_STATS", "", new Vector2(0, 20));
        TextMeshProUGUI p2Special = CreateLabel(rightPanel.transform, "P2_SPECIAL", "", new Vector2(0, -60), 14);

        Button earthTab = CreateButton(canvas.transform, "EarthShakers");
        Button thunderTab = CreateButton(canvas.transform, "ThunderBellies");
        RectTransform earthRect = earthTab.GetComponent<RectTransform>();
        RectTransform thunderRect = thunderTab.GetComponent<RectTransform>();
        earthRect.anchoredPosition = new Vector2(-90, 170);
        thunderRect.anchoredPosition = new Vector2(90, 170);

        Button startButton = CreateButton(canvas.transform, "Start Match");
        startButton.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -210);

        CharacterSelectUI ui = canvas.gameObject.AddComponent<CharacterSelectUI>();
        ui.RosterContainer = rosterPanel.transform;
        ui.EarthTab = earthTab;
        ui.ThunderTab = thunderTab;
        ui.Player1Name = p1Name;
        ui.Player1Stats = p1Stats;
        ui.Player1Special = p1Special;
        ui.Player2Name = p2Name;
        ui.Player2Stats = p2Stats;
        ui.Player2Special = p2Special;
        ui.StartButton = startButton;

        SaveScene(scene, ScenePath + "/CharacterSelect.unity");
    }

    static void CreateMatchScene(GameSettings settings)
    {
        Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        CreateLighting();
        CreateAudioManager();
        CreateGameManager();

        GameObject ringPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath + "/Ring.prefab");
        GameObject ring = (GameObject)PrefabUtility.InstantiatePrefab(ringPrefab);
        ring.transform.position = Vector3.zero;

        GameObject wrestlerPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath + "/Wrestler.prefab");
        GameObject p1 = (GameObject)PrefabUtility.InstantiatePrefab(wrestlerPrefab);
        GameObject p2 = (GameObject)PrefabUtility.InstantiatePrefab(wrestlerPrefab);
        p1.name = "Player1";
        p2.name = "Player2";
        p1.tag = "Player1";
        p2.tag = "Player2";
        p1.transform.position = new Vector3(-1.5f, 0f, 0f);
        p2.transform.position = new Vector3(1.5f, 0f, 0f);

        WrestlerController p1Controller = p1.GetComponent<WrestlerController>();
        WrestlerController p2Controller = p2.GetComponent<WrestlerController>();
        p1Controller.Opponent = p2Controller;
        p2Controller.Opponent = p1Controller;

        GameObject cameraPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath + "/CameraRig.prefab");
        GameObject cameraRig = (GameObject)PrefabUtility.InstantiatePrefab(cameraPrefab);
        CameraRig rig = cameraRig.GetComponent<CameraRig>();
        rig.TargetA = p1.transform;
        rig.TargetB = p2.transform;

        CreateMatchHUD(out MatchHUD hud, out ResultsUI results, out PauseMenu pauseMenu);

        GameObject managerGo = new GameObject("MatchManager");
        MatchManager manager = managerGo.AddComponent<MatchManager>();
        manager.Player1 = p1Controller;
        manager.Player2 = p2Controller;
        manager.Ring = ring.GetComponent<RingBoundary>();
        manager.HUD = hud;
        manager.Results = results;
        manager.Settings = settings;

        GameObject setupGo = new GameObject("MatchSetup");
        MatchSetup setup = setupGo.AddComponent<MatchSetup>();
        setup.Player1 = p1Controller;
        setup.Player2 = p2Controller;
        setup.Player1Visuals = p1.GetComponent<WrestlerVisuals>();
        setup.Player2Visuals = p2.GetComponent<WrestlerVisuals>();

        SaveScene(scene, ScenePath + "/Match.unity");
    }

    static void CreateLadderScene()
    {
        Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        CreateLighting();
        CreateUICamera();
        CreateAudioManager();
        CreateGameManager();

        Canvas canvas = CreateCanvas("LadderCanvas");
        CreateTitle(canvas.transform, "Ladder", new Vector2(0, 200));
        TextMeshProUGUI status = CreateLabel(canvas.transform, "Status", "", new Vector2(0, 40), 20);
        Button start = CreateButton(canvas.transform, "Start Bout");
        start.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -40);
        Button select = CreateButton(canvas.transform, "Select Wrestler");
        select.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -110);

        LadderUI ui = canvas.gameObject.AddComponent<LadderUI>();
        ui.StatusText = status;
        ui.StartButton = start;
        ui.SelectButton = select;

        SaveScene(scene, ScenePath + "/Ladder.unity");
    }

    static void CreateMatchHUD(out MatchHUD hud, out ResultsUI results, out PauseMenu pauseMenu)
    {
        Canvas canvas = CreateCanvas("MatchHUD");
        CreateTitle(canvas.transform, "ILLUVRSE Wrestling", new Vector2(0, 230), 20);

        Slider p1 = CreateSlider(canvas.transform, new Vector2(-220, 200));
        Slider p2 = CreateSlider(canvas.transform, new Vector2(220, 200));
        TextMeshProUGUI timer = CreateLabel(canvas.transform, "Timer", "60", new Vector2(0, 200), 24);
        TextMeshProUGUI rounds = CreateLabel(canvas.transform, "Rounds", "Rounds: 0 - 0", new Vector2(0, 180), 16);
        TextMeshProUGUI prompt = CreateLabel(canvas.transform, "Prompt", "", new Vector2(0, 160), 18);
        CreateLabel(canvas.transform, "ControlsHint", "Grab: RMB/K  Throw: E/L  Special: Q/I", new Vector2(0, -220), 14);

        GameObject resultsPanel = CreatePanel(canvas.transform, "ResultsPanel", new Vector2(0, 0), new Vector2(320, 180));
        resultsPanel.SetActive(false);
        TextMeshProUGUI resultText = CreateLabel(resultsPanel.transform, "ResultText", "", new Vector2(0, 20), 24);
        Button continueButton = CreateButton(resultsPanel.transform, "Continue");
        continueButton.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -40);

        GameObject pausePanel = CreatePanel(canvas.transform, "PausePanel", new Vector2(0, 0), new Vector2(300, 160));
        pausePanel.SetActive(false);
        CreateLabel(pausePanel.transform, "Paused", "PAUSED", new Vector2(0, 40), 22);
        Button resumeButton = CreateButton(pausePanel.transform, "Resume");
        resumeButton.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 0);
        Button quitButton = CreateButton(pausePanel.transform, "Quit");
        quitButton.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -50);

        hud = canvas.gameObject.AddComponent<MatchHUD>();
        hud.Player1Stamina = p1;
        hud.Player2Stamina = p2;
        hud.TimerText = timer;
        hud.RoundText = rounds;
        hud.PromptText = prompt;

        results = canvas.gameObject.AddComponent<ResultsUI>();
        results.Panel = resultsPanel;
        results.ResultText = resultText;
        continueButton.onClick.AddListener(results.Continue);

        pauseMenu = canvas.gameObject.AddComponent<PauseMenu>();
        pauseMenu.Panel = pausePanel;
        resumeButton.onClick.AddListener(pauseMenu.Resume);
        quitButton.onClick.AddListener(pauseMenu.QuitToMenu);
    }

    static void CreateLighting()
    {
        GameObject lightGo = new GameObject("Directional Light");
        Light light = lightGo.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.1f;
        lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
    }

    static void CreateGameManager()
    {
        GameObject managerGo = new GameObject("GameManager");
        managerGo.AddComponent<GameManager>();
    }

    static void CreateAudioManager()
    {
        GameObject audioGo = new GameObject("AudioManager");
        audioGo.AddComponent<AudioManager>();
    }

    static void CreateUICamera()
    {
        GameObject camGo = new GameObject("MenuCamera");
        Camera camera = camGo.AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.12f, 0.14f, 0.18f);
        camGo.AddComponent<AudioListener>();
    }

    static Canvas CreateCanvas(string name)
    {
        GameObject canvasGo = new GameObject(name);
        Canvas canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        CanvasScaler scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280, 720);
        canvasGo.AddComponent<GraphicRaycaster>();

        GameObject eventSystem = GameObject.Find("EventSystem");
        if (eventSystem == null)
        {
            eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<UnityEngine.EventSystems.EventSystem>();
            eventSystem.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
        }

        return canvas;
    }

    static TextMeshProUGUI CreateTitle(Transform parent, string text, Vector2 position, int size = 36)
    {
        TextMeshProUGUI label = CreateLabel(parent, "Title", text, position, size);
        label.alignment = TextAlignmentOptions.Center;
        return label;
    }

    static TextMeshProUGUI CreateLabel(Transform parent, string name, string text, Vector2 position, int size = 18)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        TextMeshProUGUI label = go.AddComponent<TextMeshProUGUI>();
        label.text = text;
        label.fontSize = size;
        label.color = Color.white;
        label.alignment = TextAlignmentOptions.Center;
        RectTransform rect = go.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(260, 80);
        rect.anchoredPosition = position;
        return label;
    }

    static GameObject CreatePanel(Transform parent, string name, Vector2 position, Vector2 size)
    {
        GameObject panel = new GameObject(name);
        panel.transform.SetParent(parent, false);
        Image image = panel.AddComponent<Image>();
        image.color = new Color(0f, 0f, 0f, 0.5f);
        RectTransform rect = panel.GetComponent<RectTransform>();
        rect.sizeDelta = size;
        rect.anchoredPosition = position;
        return panel;
    }

    static Button CreateButton(Transform parent, string label)
    {
        GameObject go = new GameObject(label + "Button");
        go.transform.SetParent(parent, false);
        Image image = go.AddComponent<Image>();
        image.color = new Color(0.85f, 0.85f, 0.85f, 1f);
        Button button = go.AddComponent<Button>();
        RectTransform rect = go.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(220, 44);

        GameObject textGo = new GameObject("Text");
        textGo.transform.SetParent(go.transform, false);
        TextMeshProUGUI text = textGo.AddComponent<TextMeshProUGUI>();
        text.text = label;
        text.fontSize = 20;
        text.color = Color.black;
        text.alignment = TextAlignmentOptions.Center;
        RectTransform textRect = textGo.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;

        return button;
    }

    static Slider CreateSlider(Transform parent, Vector2 position)
    {
        GameObject go = new GameObject("StaminaSlider");
        go.transform.SetParent(parent, false);
        Slider slider = go.AddComponent<Slider>();
        slider.minValue = 0f;
        slider.maxValue = 100f;
        RectTransform rect = go.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(220, 18);
        rect.anchoredPosition = position;
        Image bg = go.AddComponent<Image>();
        bg.color = new Color(0.2f, 0.2f, 0.2f, 1f);
        GameObject fillArea = new GameObject("Fill");
        fillArea.transform.SetParent(go.transform, false);
        Image fill = fillArea.AddComponent<Image>();
        fill.color = new Color(0.2f, 0.8f, 0.4f, 1f);
        slider.targetGraphic = fill;
        slider.fillRect = fill.GetComponent<RectTransform>();
        RectTransform fillRect = fill.GetComponent<RectTransform>();
        fillRect.anchorMin = Vector2.zero;
        fillRect.anchorMax = Vector2.one;
        fillRect.offsetMin = Vector2.zero;
        fillRect.offsetMax = Vector2.zero;
        return slider;
    }

    static void SaveScene(Scene scene, string path)
    {
        EditorSceneManager.SaveScene(scene, path);
    }

    struct WrestlerSeed
    {
        public string Id;
        public string DisplayName;
        public Division Division;
        public WrestlerStats Stats;
        public SpecialMove Special;
        public Color PrimaryColor;
        public Color SecondaryColor;
    }

    static List<WrestlerSeed> BuildSeeds()
    {
        return new List<WrestlerSeed>
        {
            new WrestlerSeed
            {
                Id = "gorath_stonebelly",
                DisplayName = "Gorath Stonebelly",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 9, Weight = 10, Speed = 3, Stamina = 8, Grip = 7 },
                Special = new SpecialMove { Name = "Stonewall", Description = "Brace hard, resisting pushes for a short time.", Type = SpecialType.Stonewall, Cooldown = 8f, StaminaCost = 10 },
                PrimaryColor = new Color(0.35f, 0.32f, 0.28f),
                SecondaryColor = new Color(0.6f, 0.5f, 0.4f)
            },
            new WrestlerSeed
            {
                Id = "mammok_rooted",
                DisplayName = "Mammok the Rooted",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 8, Weight = 9, Speed = 4, Stamina = 7, Grip = 8 },
                Special = new SpecialMove { Name = "Rooted Stomp", Description = "Stomp to push back nearby foes.", Type = SpecialType.RootedStomp, Cooldown = 9f, StaminaCost = 10 },
                PrimaryColor = new Color(0.28f, 0.45f, 0.28f),
                SecondaryColor = new Color(0.5f, 0.6f, 0.35f)
            },
            new WrestlerSeed
            {
                Id = "iron_kato",
                DisplayName = "Iron Kato",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 7, Weight = 8, Speed = 5, Stamina = 7, Grip = 9 },
                Special = new SpecialMove { Name = "Iron Clinch", Description = "Lunge with extended grab reach.", Type = SpecialType.IronClinch, Cooldown = 7f, StaminaCost = 9 },
                PrimaryColor = new Color(0.45f, 0.45f, 0.5f),
                SecondaryColor = new Color(0.7f, 0.7f, 0.75f)
            },
            new WrestlerSeed
            {
                Id = "basalt_oni",
                DisplayName = "Basalt Oni",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 8, Weight = 9, Speed = 4, Stamina = 6, Grip = 7 },
                Special = new SpecialMove { Name = "Molten Charge", Description = "Short charging shove that hits hard.", Type = SpecialType.MoltenCharge, Cooldown = 8f, StaminaCost = 9 },
                PrimaryColor = new Color(0.4f, 0.2f, 0.2f),
                SecondaryColor = new Color(0.7f, 0.35f, 0.3f)
            },
            new WrestlerSeed
            {
                Id = "toru_earthhand",
                DisplayName = "Toru Earthhand",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 6, Weight = 7, Speed = 5, Stamina = 7, Grip = 6 },
                Special = new SpecialMove { Name = "Earth Hand", Description = "Heavy palm strike that slows the foe.", Type = SpecialType.EarthHand, Cooldown = 7f, StaminaCost = 8 },
                PrimaryColor = new Color(0.5f, 0.35f, 0.25f),
                SecondaryColor = new Color(0.7f, 0.55f, 0.4f)
            },
            new WrestlerSeed
            {
                Id = "gravel_lord",
                DisplayName = "Gravel Lord",
                Division = Division.EarthShakers,
                Stats = new WrestlerStats { Power = 7, Weight = 8, Speed = 4, Stamina = 8, Grip = 6 },
                Special = new SpecialMove { Name = "Gravel Grind", Description = "Drain stamina from close opponents.", Type = SpecialType.GravelGrind, Cooldown = 9f, StaminaCost = 10 },
                PrimaryColor = new Color(0.3f, 0.3f, 0.3f),
                SecondaryColor = new Color(0.55f, 0.55f, 0.55f)
            },
            new WrestlerSeed
            {
                Id = "zappo_storm",
                DisplayName = "Zappo the Rolling Storm",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 6, Weight = 5, Speed = 9, Stamina = 6, Grip = 6 },
                Special = new SpecialMove { Name = "Storm Roll", Description = "Quick roll with a burst shove.", Type = SpecialType.StormRoll, Cooldown = 7f, StaminaCost = 8 },
                PrimaryColor = new Color(0.2f, 0.45f, 0.8f),
                SecondaryColor = new Color(0.6f, 0.8f, 1f)
            },
            new WrestlerSeed
            {
                Id = "bellyboom_rex",
                DisplayName = "BellyBoom Rex",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 7, Weight = 6, Speed = 7, Stamina = 5, Grip = 5 },
                Special = new SpecialMove { Name = "Belly Boom", Description = "Explosive slam that can knock down.", Type = SpecialType.BellyBoom, Cooldown = 8f, StaminaCost = 9 },
                PrimaryColor = new Color(0.85f, 0.55f, 0.2f),
                SecondaryColor = new Color(1f, 0.8f, 0.4f)
            },
            new WrestlerSeed
            {
                Id = "raijin_lump",
                DisplayName = "Raijin Lump",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 6, Weight = 5, Speed = 8, Stamina = 6, Grip = 6 },
                Special = new SpecialMove { Name = "Thunder Clap", Description = "Stunning clap slows enemy movement.", Type = SpecialType.ThunderClap, Cooldown = 7f, StaminaCost = 8 },
                PrimaryColor = new Color(0.45f, 0.35f, 0.9f),
                SecondaryColor = new Color(0.7f, 0.6f, 1f)
            },
            new WrestlerSeed
            {
                Id = "sumo_nova",
                DisplayName = "Sumo Nova",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 7, Weight = 6, Speed = 8, Stamina = 5, Grip = 5 },
                Special = new SpecialMove { Name = "Nova Burst", Description = "Short-range blast push.", Type = SpecialType.NovaBurst, Cooldown = 8f, StaminaCost = 9 },
                PrimaryColor = new Color(0.9f, 0.25f, 0.25f),
                SecondaryColor = new Color(1f, 0.6f, 0.5f)
            },
            new WrestlerSeed
            {
                Id = "whiplash_goro",
                DisplayName = "Whiplash Goro",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 6, Weight = 5, Speed = 8, Stamina = 6, Grip = 7 },
                Special = new SpecialMove { Name = "Whiplash Throw", Description = "Enhanced throw or quick grab attempt.", Type = SpecialType.WhiplashThrow, Cooldown = 7f, StaminaCost = 8 },
                PrimaryColor = new Color(0.8f, 0.2f, 0.6f),
                SecondaryColor = new Color(1f, 0.6f, 0.85f)
            },
            new WrestlerSeed
            {
                Id = "static_taro",
                DisplayName = "Static Taro",
                Division = Division.ThunderBellies,
                Stats = new WrestlerStats { Power = 5, Weight = 4, Speed = 9, Stamina = 6, Grip = 5 },
                Special = new SpecialMove { Name = "Static Step", Description = "Flash step to evade and reposition.", Type = SpecialType.StaticStep, Cooldown = 6f, StaminaCost = 7 },
                PrimaryColor = new Color(0.2f, 0.8f, 0.85f),
                SecondaryColor = new Color(0.6f, 1f, 1f)
            }
        };
    }
}
