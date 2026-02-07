using System.Collections.Generic;
using UnityEngine;
using TMPro;
using UnityEngine.UI;
using IlluvrseWrestling.Core;
using IlluvrseWrestling.Data;

namespace IlluvrseWrestling.UI
{
    public class LadderUI : MonoBehaviour
    {
        public RosterDatabase Roster;
        public TextMeshProUGUI StatusText;
        public Button StartButton;
        public Button SelectButton;

        void Start()
        {
            if (Roster == null)
            {
                Roster = Resources.Load<RosterDatabase>("RosterDatabase");
            }
            if (StartButton != null)
            {
                StartButton.onClick.AddListener(StartNextMatch);
            }
            if (SelectButton != null)
            {
                SelectButton.onClick.AddListener(OpenCharacterSelect);
            }
            RefreshStatus();
        }

        void RefreshStatus()
        {
            GameManager manager = GameManager.Instance;
            if (manager == null || manager.Player1 == null)
            {
                if (StatusText != null)
                {
                    StatusText.text = "Select your wrestler in Character Select.";
                }
                return;
            }

            if (manager.LadderOpponents.Count == 0 && Roster != null)
            {
                BuildLadder(manager, Roster);
            }

            if (manager.CurrentLadderIndex >= manager.LadderOpponents.Count)
            {
                if (StatusText != null)
                {
                    StatusText.text = "LADDER COMPLETE!";
                }
                return;
            }

            WrestlerData next = manager.LadderOpponents[manager.CurrentLadderIndex];
            if (StatusText != null)
            {
                StatusText.text = "Next Opponent: " + next.DisplayName;
            }
        }

        void BuildLadder(GameManager manager, RosterDatabase roster)
        {
            List<WrestlerData> list = new List<WrestlerData>();
            for (int i = 0; i < roster.Wrestlers.Count; i++)
            {
                WrestlerData data = roster.Wrestlers[i];
                if (data != null && data != manager.Player1)
                {
                    list.Add(data);
                }
            }

            for (int i = 0; i < list.Count; i++)
            {
                int swap = Random.Range(i, list.Count);
                WrestlerData temp = list[i];
                list[i] = list[swap];
                list[swap] = temp;
            }

            manager.LadderOpponents = list;
            manager.CurrentLadderIndex = 0;
        }

        void StartNextMatch()
        {
            GameManager manager = GameManager.Instance;
            if (manager == null || manager.Player1 == null)
            {
                UnityEngine.SceneManagement.SceneManager.LoadScene("CharacterSelect");
                return;
            }

            if (manager.CurrentLadderIndex >= manager.LadderOpponents.Count)
            {
                UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
                return;
            }

            WrestlerData opponent = manager.LadderOpponents[manager.CurrentLadderIndex];
            manager.SetPlayers(manager.Player1, opponent, true);
            UnityEngine.SceneManagement.SceneManager.LoadScene("Match");
        }

        void OpenCharacterSelect()
        {
            UnityEngine.SceneManagement.SceneManager.LoadScene("CharacterSelect");
        }
    }
}
