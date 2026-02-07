using UnityEngine;
using IlluvrseWrestling.Combat;
using IlluvrseWrestling.Data;

namespace IlluvrseWrestling.Core
{
    public class MatchSetup : MonoBehaviour
    {
        public WrestlerController Player1;
        public WrestlerController Player2;
        public WrestlerVisuals Player1Visuals;
        public WrestlerVisuals Player2Visuals;

        void Start()
        {
            GameManager manager = GameManager.Instance;
            if (manager == null)
            {
                return;
            }

            ApplyPlayer(Player1, Player1Visuals, manager.Player1, true, false);

            WrestlerData p2Data = manager.Mode == GameMode.Ladder ? manager.Player2 : manager.Player2;
            bool p2IsAI = manager.Player2IsAI || manager.Mode == GameMode.Ladder;
            ApplyPlayer(Player2, Player2Visuals, p2Data, false, p2IsAI);

            if (Player1 != null && Player2 != null)
            {
                Player1.Opponent = Player2;
                Player2.Opponent = Player1;
            }
        }

        void ApplyPlayer(WrestlerController controller, WrestlerVisuals visuals, WrestlerData data, bool isPlayerOne, bool isAI)
        {
            if (controller == null)
            {
                return;
            }
            controller.ApplyData(data);
            controller.IsAI = isAI;
            controller.IsPlayerOne = isPlayerOne;
            PlayerInputProvider input = controller.GetComponent<PlayerInputProvider>();
            if (input != null)
            {
                input.IsPlayerOne = isPlayerOne;
                input.enabled = !isAI;
            }
            AI.AIController ai = controller.GetComponent<AI.AIController>();
            if (ai != null)
            {
                ai.enabled = isAI;
            }
            if (visuals != null)
            {
                visuals.Data = data;
                visuals.Apply();
            }
        }
    }
}
