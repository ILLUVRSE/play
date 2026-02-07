using UnityEngine;

namespace IlluvrseWrestling.UI
{
    public class PauseMenu : MonoBehaviour
    {
        public GameObject Panel;

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Toggle();
            }
        }

        public void Toggle()
        {
            bool active = Panel != null && Panel.activeSelf;
            if (Panel != null)
            {
                Panel.SetActive(!active);
            }
            Time.timeScale = active ? 1f : 0f;
        }

        public void Resume()
        {
            if (Panel != null)
            {
                Panel.SetActive(false);
            }
            Time.timeScale = 1f;
        }

        public void QuitToMenu()
        {
            Time.timeScale = 1f;
            UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
        }
    }
}
