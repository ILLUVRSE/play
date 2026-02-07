using UnityEngine;

namespace IlluvrseWrestling.Data
{
    public enum Division
    {
        EarthShakers,
        ThunderBellies
    }

    public enum SpecialType
    {
        Stonewall,
        RootedStomp,
        IronClinch,
        MoltenCharge,
        EarthHand,
        GravelGrind,
        StormRoll,
        BellyBoom,
        ThunderClap,
        NovaBurst,
        WhiplashThrow,
        StaticStep
    }

    [System.Serializable]
    public struct WrestlerStats
    {
        [Range(1, 10)] public int Power;
        [Range(1, 10)] public int Weight;
        [Range(1, 10)] public int Speed;
        [Range(1, 10)] public int Stamina;
        [Range(1, 10)] public int Grip;
    }

    [System.Serializable]
    public struct SpecialMove
    {
        public string Name;
        [TextArea(2, 4)] public string Description;
        public SpecialType Type;
        public float Cooldown;
        public int StaminaCost;
    }

    [CreateAssetMenu(menuName = "ILLUVRSE/Wrestler Data", fileName = "WrestlerData")]
    public class WrestlerData : ScriptableObject
    {
        public string Id;
        public string DisplayName;
        public Division Division;
        public WrestlerStats Stats;
        public SpecialMove Special;
        public Color PrimaryColor = Color.white;
        public Color SecondaryColor = Color.gray;
    }
}
