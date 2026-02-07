using UnityEngine;
using IlluvrseWrestling.Core;

namespace IlluvrseWrestling.UI
{
    public class MainMenuUI : MonoBehaviour
    {
        public GameObject OptionsPanel;

        public void PlayQuickMatch()
        {
            GameManager.Instance?.SetMode(GameMode.QuickMatch);
            UnityEngine.SceneManagement.SceneManager.LoadScene("CharacterSelect");
        }

        public void PlayVersus()
        {
            GameManager.Instance?.SetMode(GameMode.Versus);
            UnityEngine.SceneManagement.SceneManager.LoadScene("CharacterSelect");
        }

        public void PlayLadder()
        {
            GameManager.Instance?.SetMode(GameMode.Ladder);
            UnityEngine.SceneManagement.SceneManager.LoadScene("Ladder");
        }

        public void ToggleOptions()
        {
            if (OptionsPanel != null)
            {
                OptionsPanel.SetActive(!OptionsPanel.activeSelf);
            }
        }

        public void Quit()
        {
            Application.Quit();
        }
    }
}
