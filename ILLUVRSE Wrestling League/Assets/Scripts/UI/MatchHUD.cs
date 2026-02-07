using UnityEngine;
using UnityEngine.UI;
using TMPro;
using IlluvrseWrestling.Combat;

namespace IlluvrseWrestling.UI
{
    public class MatchHUD : MonoBehaviour
    {
        public Slider Player1Stamina;
        public Slider Player2Stamina;
        public TextMeshProUGUI TimerText;
        public TextMeshProUGUI RoundText;
        public TextMeshProUGUI PromptText;

        WrestlerController p1;
        WrestlerController p2;

        void Start()
        {
            p1 = GameObject.FindWithTag("Player1")?.GetComponent<WrestlerController>();
            p2 = GameObject.FindWithTag("Player2")?.GetComponent<WrestlerController>();
            if (p1 != null && Player1Stamina != null)
            {
                Player1Stamina.maxValue = p1.CurrentStamina;
            }
            if (p2 != null && Player2Stamina != null)
            {
                Player2Stamina.maxValue = p2.CurrentStamina;
            }
        }

        void Update()
        {
            if (p1 != null && Player1Stamina != null)
            {
                Player1Stamina.value = p1.CurrentStamina;
            }
            if (p2 != null && Player2Stamina != null)
            {
                Player2Stamina.value = p2.CurrentStamina;
            }
            if (RoundText != null)
            {
                var manager = Core.GameManager.Instance;
                if (manager != null)
                {
                    RoundText.text = "Rounds: " + manager.Player1Rounds + " - " + manager.Player2Rounds;
                }
            }
        }

        public void SetTimer(float timeRemaining)
        {
            if (TimerText != null)
            {
                TimerText.text = Mathf.Max(0f, timeRemaining).ToString("0");
            }
        }

        public void ShowRoundIntro()
        {
            if (PromptText != null)
            {
                PromptText.text = "READY";
                Invoke(nameof(ClearPrompt), 1f);
            }
        }

        public void ShowRoundResult(int winnerIndex, string reason)
        {
            if (PromptText == null)
            {
                return;
            }
            if (winnerIndex == 0)
            {
                PromptText.text = reason + " - DRAW";
            }
            else
            {
                PromptText.text = "PLAYER " + winnerIndex + " WINS - " + reason;
            }
        }

        public void ResetHUD()
        {
            ClearPrompt();
        }

        public void ShowKnockdownCount(float timer, float countTime)
        {
            if (PromptText == null)
            {
                return;
            }
            int count = Mathf.Clamp(Mathf.CeilToInt(countTime - timer), 0, Mathf.CeilToInt(countTime));
            PromptText.text = "COUNT: " + count;
        }

        void ClearPrompt()
        {
            if (PromptText != null)
            {
                PromptText.text = string.Empty;
            }
        }
    }
}
