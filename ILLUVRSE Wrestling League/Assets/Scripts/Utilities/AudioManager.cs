using UnityEngine;

namespace IlluvrseWrestling.Utilities
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        AudioSource source;
        AudioClip click;
        AudioClip hit;
        AudioClip ringOut;
        AudioClip cheer;
        AudioClip tick;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            source = gameObject.AddComponent<AudioSource>();
            click = CreateTone(880f, 0.08f);
            hit = CreateTone(220f, 0.12f);
            ringOut = CreateTone(140f, 0.4f);
            cheer = CreateTone(520f, 0.5f);
            tick = CreateTone(1000f, 0.05f);
        }

        AudioClip CreateTone(float frequency, float duration)
        {
            int sampleRate = 44100;
            int samples = Mathf.CeilToInt(sampleRate * duration);
            float[] data = new float[samples];
            for (int i = 0; i < samples; i++)
            {
                data[i] = Mathf.Sin(2f * Mathf.PI * frequency * i / sampleRate) * 0.25f;
            }
            AudioClip clip = AudioClip.Create("tone_" + frequency, samples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        void Play(AudioClip clip)
        {
            if (clip != null)
            {
                source.PlayOneShot(clip);
            }
        }

        public void PlayClick() => Play(click);
        public void PlayHit() => Play(hit);
        public void PlayRingOut() => Play(ringOut);
        public void PlayCheer() => Play(cheer);
        public void PlayTick() => Play(tick);
    }
}
