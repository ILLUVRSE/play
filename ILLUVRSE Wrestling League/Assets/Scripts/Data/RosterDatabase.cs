using System.Collections.Generic;
using UnityEngine;

namespace IlluvrseWrestling.Data
{
    [CreateAssetMenu(menuName = "ILLUVRSE/Roster Database", fileName = "RosterDatabase")]
    public class RosterDatabase : ScriptableObject
    {
        public List<WrestlerData> Wrestlers = new List<WrestlerData>();

        public WrestlerData GetById(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return null;
            }

            for (int i = 0; i < Wrestlers.Count; i++)
            {
                if (Wrestlers[i] != null && Wrestlers[i].Id == id)
                {
                    return Wrestlers[i];
                }
            }

            return null;
        }

        public List<WrestlerData> GetByDivision(Division division)
        {
            List<WrestlerData> results = new List<WrestlerData>();
            for (int i = 0; i < Wrestlers.Count; i++)
            {
                if (Wrestlers[i] != null && Wrestlers[i].Division == division)
                {
                    results.Add(Wrestlers[i]);
                }
            }
            return results;
        }
    }
}
