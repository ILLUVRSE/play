using UnityEngine;
using UnityEngine.SceneManagement;

namespace IlluvrseWrestling.Core
{
    public class SceneLoader : MonoBehaviour
    {
        public void LoadScene(string sceneName)
        {
            SceneManager.LoadScene(sceneName);
        }

        public void Quit()
        {
            Application.Quit();
        }
    }
}
