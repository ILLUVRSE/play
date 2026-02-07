using UnityEngine;
using IlluvrseWrestling.Combat;
using IlluvrseWrestling.Core;

namespace IlluvrseWrestling.AI
{
    public class AIController : MonoBehaviour
    {
        public WrestlerController Self;
        public RingBoundary Ring;
        public bool ShowGizmos;

        enum AIState
        {
            Approach,
            Attack,
            Grab,
            Throw,
            Reposition,
            Recover
        }

        AIState state;
        float nextDecisionTime;

        void Awake()
        {
            if (Self == null)
            {
                Self = GetComponent<WrestlerController>();
            }
        }

        void Update()
        {
            if (Self == null || Self.Opponent == null)
            {
                return;
            }

            if (Time.time >= nextDecisionTime)
            {
                DecideState();
                nextDecisionTime = Time.time + Random.Range(0.2f, 0.4f);
            }

            WrestlerInput input = BuildInput();
            Self.SetAIInput(input);
        }

        void DecideState()
        {
            float distance = Vector3.Distance(Self.transform.position, Self.Opponent.transform.position);
            bool nearEdge = Ring != null && Ring.IsOut(Self.transform.position + (Self.transform.position - Ring.transform.position).normalized * 1f);

            if (Self.CurrentStamina < 8f)
            {
                state = AIState.Recover;
                return;
            }

            if (nearEdge)
            {
                state = AIState.Reposition;
                return;
            }

            if (distance > 2.5f)
            {
                state = AIState.Approach;
            }
            else if (distance <= 1.1f)
            {
                state = Random.value > 0.5f ? AIState.Grab : AIState.Attack;
            }
            else
            {
                state = AIState.Attack;
            }
        }

        WrestlerInput BuildInput()
        {
            WrestlerInput input = new WrestlerInput();
            Vector3 toOpponent = (Self.Opponent.transform.position - Self.transform.position);
            Vector2 move = new Vector2(Mathf.Sign(toOpponent.x), Mathf.Sign(toOpponent.z));

            switch (state)
            {
                case AIState.Approach:
                    input.Move = move;
                    input.Push = Random.value > 0.8f;
                    break;
                case AIState.Attack:
                    input.Move = move * 0.5f;
                    input.Push = true;
                    input.Dodge = Random.value > 0.85f;
                    break;
                case AIState.Grab:
                    input.Move = move * 0.3f;
                    input.GrabHeld = true;
                    input.Throw = Random.value > 0.6f;
                    break;
                case AIState.Throw:
                    input.Throw = true;
                    break;
                case AIState.Reposition:
                    input.Move = -move;
                    input.Dodge = Random.value > 0.7f;
                    break;
                case AIState.Recover:
                    input.Move = -move * 0.5f;
                    break;
            }

            if (Random.value > 0.97f)
            {
                input.Special = true;
            }

            return input;
        }

        void OnDrawGizmosSelected()
        {
            if (!ShowGizmos || Self == null || Self.Opponent == null)
            {
                return;
            }
            Gizmos.color = Color.cyan;
            Gizmos.DrawLine(Self.transform.position, Self.Opponent.transform.position);
        }
    }
}
