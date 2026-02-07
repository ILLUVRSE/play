using UnityEngine;
using UnityEngine.EventSystems;

namespace IlluvrseWrestling.Utilities
{
    public static class RuntimeBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void EnsureCoreSystems()
        {
            if (Object.FindObjectOfType<EventSystem>() == null)
            {
                GameObject eventSystem = new GameObject("EventSystem");
                eventSystem.AddComponent<EventSystem>();
                eventSystem.AddComponent<StandaloneInputModule>();
            }

            Camera camera = Object.FindObjectOfType<Camera>();
            if (camera == null)
            {
                GameObject camGo = new GameObject("AutoCamera");
                camera = camGo.AddComponent<Camera>();
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = new Color(0.12f, 0.14f, 0.18f);
            }

            if (Object.FindObjectOfType<AudioListener>() == null)
            {
                camera.gameObject.AddComponent<AudioListener>();
            }
        }
    }
}
