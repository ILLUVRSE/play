using UnityEngine;
using TMPro;
using IlluvrseWrestling.Core;

namespace IlluvrseWrestling.UI
{
    public class ResultsUI : MonoBehaviour
    {
        public GameObject Panel;
        public TextMeshProUGUI ResultText;

        public void ShowMatchResult(int winnerIndex)
        {
            if (Panel != null)
            {
                Panel.SetActive(true);
            }
            if (ResultText != null)
            {
                ResultText.text = winnerIndex == 0 ? "DRAW" : "PLAYER " + winnerIndex + " WINS!";
            }
        }

        public void Continue()
        {
            GameManager manager = GameManager.Instance;
            if (manager != null && manager.Mode == GameMode.Ladder)
            {
                UnityEngine.SceneManagement.SceneManager.LoadScene("Ladder");
                return;
            }
            UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
        }
    }
}
