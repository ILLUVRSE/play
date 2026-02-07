using UnityEngine;

namespace IlluvrseWrestling.Data
{
    [CreateAssetMenu(menuName = "ILLUVRSE/Game Settings", fileName = "GameSettings")]
    public class GameSettings : ScriptableObject
    {
        public float RingRadius = 6f;
        public float LaneDepth = 2.25f;
        public float MaxSpeed = 6.5f;
        public float RoundTime = 60f;
        public int BestOfRounds = 3;
        public float KnockdownCountTime = 3f;
        public float StaminaRegenPerSecond = 6f;
    }
}
