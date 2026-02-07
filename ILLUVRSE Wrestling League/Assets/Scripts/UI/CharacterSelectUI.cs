using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using IlluvrseWrestling.Core;
using IlluvrseWrestling.Data;

namespace IlluvrseWrestling.UI
{
    public class CharacterSelectUI : MonoBehaviour
    {
        public RosterDatabase Roster;
        public Transform RosterContainer;
        public Button EarthTab;
        public Button ThunderTab;
        public TextMeshProUGUI Player1Name;
        public TextMeshProUGUI Player1Stats;
        public TextMeshProUGUI Player1Special;
        public TextMeshProUGUI Player2Name;
        public TextMeshProUGUI Player2Stats;
        public TextMeshProUGUI Player2Special;
        public Button StartButton;

        Division currentDivision = Division.EarthShakers;
        List<Button> currentButtons = new List<Button>();
        WrestlerData selectedP1;
        WrestlerData selectedP2;

        void Start()
        {
            if (Roster == null)
            {
                Roster = Resources.Load<RosterDatabase>("RosterDatabase");
            }

            if (EarthTab != null)
            {
                EarthTab.onClick.AddListener(() => SwitchDivision(Division.EarthShakers));
            }
            if (ThunderTab != null)
            {
                ThunderTab.onClick.AddListener(() => SwitchDivision(Division.ThunderBellies));
            }

            SwitchDivision(currentDivision);
            if (StartButton != null)
            {
                StartButton.onClick.AddListener(StartMatch);
            }
        }

        void SwitchDivision(Division division)
        {
            currentDivision = division;
            ClearRosterButtons();
            if (Roster == null)
            {
                return;
            }
            List<WrestlerData> list = Roster.GetByDivision(division);
            for (int i = 0; i < list.Count; i++)
            {
                WrestlerData data = list[i];
                Button button = CreateRosterButton(data);
                currentButtons.Add(button);
            }
        }

        Button CreateRosterButton(WrestlerData data)
        {
            GameObject go = new GameObject("Card_" + data.DisplayName);
            go.transform.SetParent(RosterContainer, false);
            Image image = go.AddComponent<Image>();
            image.color = data.PrimaryColor;
            Button button = go.AddComponent<Button>();

            GameObject label = new GameObject("Label");
            label.transform.SetParent(go.transform, false);
            TextMeshProUGUI text = label.AddComponent<TextMeshProUGUI>();
            text.text = data.DisplayName;
            text.fontSize = 18;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.black;
            RectTransform rect = go.GetComponent<RectTransform>();
            rect.sizeDelta = new Vector2(180, 40);
            RectTransform labelRect = label.GetComponent<RectTransform>();
            labelRect.anchorMin = Vector2.zero;
            labelRect.anchorMax = Vector2.one;
            labelRect.offsetMin = Vector2.zero;
            labelRect.offsetMax = Vector2.zero;

            button.onClick.AddListener(() => OnSelectWrestler(data));
            return button;
        }

        void OnSelectWrestler(WrestlerData data)
        {
            GameMode mode = GameManager.Instance != null ? GameManager.Instance.Mode : GameMode.QuickMatch;
            if (selectedP1 == null)
            {
                selectedP1 = data;
                UpdatePreview(1, data);
                return;
            }

            if (mode == GameMode.Ladder)
            {
                selectedP1 = data;
                UpdatePreview(1, data);
                return;
            }

            if (selectedP2 == null || selectedP1 == data)
            {
                selectedP2 = data;
                UpdatePreview(2, data);
                return;
            }

            selectedP1 = data;
            UpdatePreview(1, data);
        }

        void UpdatePreview(int playerIndex, WrestlerData data)
        {
            string stats = $"Power {data.Stats.Power}  Weight {data.Stats.Weight}  Speed {data.Stats.Speed}  Stamina {data.Stats.Stamina}  Grip {data.Stats.Grip}";
            if (playerIndex == 1)
            {
                if (Player1Name != null) Player1Name.text = data.DisplayName;
                if (Player1Stats != null) Player1Stats.text = stats;
                if (Player1Special != null) Player1Special.text = data.Special.Name + ": " + data.Special.Description;
            }
            else
            {
                if (Player2Name != null) Player2Name.text = data.DisplayName;
                if (Player2Stats != null) Player2Stats.text = stats;
                if (Player2Special != null) Player2Special.text = data.Special.Name + ": " + data.Special.Description;
            }
        }

        void StartMatch()
        {
            if (selectedP1 == null)
            {
                return;
            }
            GameManager manager = GameManager.Instance;
            if (manager == null)
            {
                return;
            }

            if (manager.Mode == GameMode.Ladder)
            {
                manager.SetPlayers(selectedP1, null, true);
                UnityEngine.SceneManagement.SceneManager.LoadScene("Ladder");
                return;
            }

            if (selectedP2 == null)
            {
                selectedP2 = selectedP1;
            }
            bool p2AI = manager.Mode == GameMode.QuickMatch;
            manager.SetPlayers(selectedP1, selectedP2, p2AI);
            UnityEngine.SceneManagement.SceneManager.LoadScene("Match");
        }

        void ClearRosterButtons()
        {
            for (int i = 0; i < currentButtons.Count; i++)
            {
                if (currentButtons[i] != null)
                {
                    Destroy(currentButtons[i].gameObject);
                }
            }
            currentButtons.Clear();
        }
    }
}
