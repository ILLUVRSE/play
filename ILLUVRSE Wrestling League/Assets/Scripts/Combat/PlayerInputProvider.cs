using UnityEngine;

namespace IlluvrseWrestling.Combat
{
    public class PlayerInputProvider : MonoBehaviour
    {
        public bool IsPlayerOne = true;

        public WrestlerInput GetInput()
        {
            WrestlerInput input = new WrestlerInput();
            if (IsPlayerOne)
            {
                input.Move = new Vector2(
                    (Input.GetKey(KeyCode.D) ? 1f : 0f) + (Input.GetKey(KeyCode.A) ? -1f : 0f),
                    (Input.GetKey(KeyCode.W) ? 1f : 0f) + (Input.GetKey(KeyCode.S) ? -1f : 0f));
                input.Jump = Input.GetKeyDown(KeyCode.Space);
                input.Push = Input.GetMouseButtonDown(0);
                input.GrabHeld = Input.GetMouseButton(1);
                input.Throw = Input.GetKeyDown(KeyCode.E);
                input.Dodge = Input.GetKeyDown(KeyCode.LeftShift);
                input.Special = Input.GetKeyDown(KeyCode.Q);
            }
            else
            {
                input.Move = new Vector2(
                    (Input.GetKey(KeyCode.RightArrow) ? 1f : 0f) + (Input.GetKey(KeyCode.LeftArrow) ? -1f : 0f),
                    (Input.GetKey(KeyCode.UpArrow) ? 1f : 0f) + (Input.GetKey(KeyCode.DownArrow) ? -1f : 0f));
                input.Jump = Input.GetKeyDown(KeyCode.RightShift);
                input.Push = Input.GetKeyDown(KeyCode.J);
                input.GrabHeld = Input.GetKey(KeyCode.K);
                input.Throw = Input.GetKeyDown(KeyCode.L);
                input.Dodge = Input.GetKeyDown(KeyCode.U);
                input.Special = Input.GetKeyDown(KeyCode.I);
            }
            return input;
        }
    }
}
