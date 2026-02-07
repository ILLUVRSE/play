using System.Collections;
using UnityEngine;
using IlluvrseWrestling.Data;
using IlluvrseWrestling.Utilities;

namespace IlluvrseWrestling.Combat
{
    public struct WrestlerInput
    {
        public Vector2 Move;
        public bool Jump;
        public bool Push;
        public bool GrabHeld;
        public bool Throw;
        public bool Dodge;
        public bool Special;
    }

    public class WrestlerController : MonoBehaviour
    {
        public WrestlerData Data;
        public WrestlerController Opponent;
        public bool IsAI;
        public bool IsPlayerOne;

        [Header("Tuning")]
        public float PushRange = 1.4f;
        public float GrabRange = 1.1f;
        public float PushForce = 9f;
        public float ThrowForce = 12f;
        public float JumpForce = 4.5f;
        public float DodgeForce = 6f;
        public float AttackCooldown = 0.5f;
        public float GrabCooldown = 0.6f;
        public float DodgeCooldown = 1.5f;

        [Header("Runtime")]
        public float CurrentStamina;
        public bool IsKnockedDown { get; private set; }
        public float KnockdownTimer { get; private set; }

        Rigidbody rb;
        bool isGrabbing;
        bool isGrabbed;
        WrestlerController currentGrabber;
        float nextAttackTime;
        float nextGrabTime;
        float nextDodgeTime;
        float specialReadyTime;
        float stabilityMultiplier = 1f;
        float speedMultiplier = 1f;
        float staminaRegen;
        float maxStamina;
        float laneDepth = 2.25f;
        WrestlerInput aiInput;
        PlayerInputProvider playerInput;
        bool specialActive;

        void Awake()
        {
            rb = GetComponent<Rigidbody>();
            playerInput = GetComponent<PlayerInputProvider>();
        }

        void Start()
        {
            ApplyStats();
            ResetForRound();
            GameSettings settings = Resources.Load<GameSettings>("GameSettings");
            if (settings != null)
            {
                laneDepth = settings.LaneDepth;
            }
        }

        public void ApplyData(WrestlerData data)
        {
            Data = data;
            ApplyStats();
            ResetForRound();
        }

        void ApplyStats()
        {
            if (Data == null)
            {
                return;
            }

            maxStamina = Data.Stats.Stamina * 10f;
            CurrentStamina = maxStamina;
            staminaRegen = Data.Stats.Stamina * 0.6f;

            if (rb != null)
            {
                rb.mass = Mathf.Lerp(1.2f, 4f, Data.Stats.Weight / 10f);
                rb.drag = 3f;
                rb.angularDrag = 6f;
            }
        }

        void Update()
        {
            if (IsKnockedDown)
            {
                KnockdownTimer += Time.deltaTime;
                return;
            }

            WrestlerInput input = IsAI ? aiInput : (playerInput != null ? playerInput.GetInput() : aiInput);
            HandleActions(input);
            RegenerateStamina(Time.deltaTime);
        }

        void FixedUpdate()
        {
            if (IsKnockedDown)
            {
                rb.velocity = Vector3.zero;
                return;
            }

            if (isGrabbed && currentGrabber != null)
            {
                rb.velocity = Vector3.zero;
                transform.position = currentGrabber.transform.position + currentGrabber.transform.forward * 0.8f;
                return;
            }

            WrestlerInput input = IsAI ? aiInput : (playerInput != null ? playerInput.GetInput() : aiInput);
            Move(input);
            ClampLane();
        }

        void Move(WrestlerInput input)
        {
            if (isGrabbed)
            {
                return;
            }

            float speed = GetMoveSpeed();
            Vector3 desired = new Vector3(input.Move.x, 0f, input.Move.y) * speed * speedMultiplier;
            Vector3 velocity = rb.velocity;
            velocity.x = desired.x;
            velocity.z = desired.z;
            rb.velocity = ClampVelocity(velocity);

            if (Opponent != null)
            {
                Vector3 look = Opponent.transform.position - transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f)
                {
                    transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(look), 10f * Time.deltaTime);
                }
            }
        }

        Vector3 ClampVelocity(Vector3 velocity)
        {
            float maxSpeed = GetMoveSpeed() * 1.15f;
            Vector3 flat = new Vector3(velocity.x, 0f, velocity.z);
            if (flat.magnitude > maxSpeed)
            {
                flat = flat.normalized * maxSpeed;
            }
            return new Vector3(flat.x, velocity.y, flat.z);
        }

        float GetMoveSpeed()
        {
            if (Data == null)
            {
                return 5f;
            }
            return Mathf.Lerp(3.5f, 7.5f, Data.Stats.Speed / 10f);
        }

        void HandleActions(WrestlerInput input)
        {
            if (input.Jump && IsGrounded())
            {
                rb.AddForce(Vector3.up * JumpForce, ForceMode.Impulse);
            }

            if (input.Dodge && Time.time >= nextDodgeTime && CurrentStamina >= 4f)
            {
                nextDodgeTime = Time.time + DodgeCooldown;
                CurrentStamina -= 4f;
                Vector3 dodgeDir = new Vector3(0f, 0f, Mathf.Sign(input.Move.y));
                if (Mathf.Abs(dodgeDir.z) < 0.01f)
                {
                    dodgeDir.z = Opponent != null && Opponent.transform.position.z > transform.position.z ? -1f : 1f;
                }
                rb.AddForce(dodgeDir.normalized * DodgeForce, ForceMode.Impulse);
            }

            if (input.Push && Time.time >= nextAttackTime)
            {
                TryPush();
            }

            if (input.GrabHeld && Time.time >= nextGrabTime)
            {
                TryGrab();
            }
            else if (!input.GrabHeld && isGrabbing)
            {
                ReleaseGrab();
            }

            if (input.Throw)
            {
                TryThrow();
            }

            if (input.Special && Time.time >= specialReadyTime && Data != null)
            {
                StartCoroutine(PerformSpecial(Data.Special));
            }
        }

        void RegenerateStamina(float delta)
        {
            if (IsKnockedDown || specialActive)
            {
                return;
            }

            CurrentStamina = Mathf.Min(maxStamina, CurrentStamina + staminaRegen * delta);
        }

        bool IsGrounded()
        {
            return Physics.Raycast(transform.position + Vector3.up * 0.1f, Vector3.down, 0.2f);
        }

        void TryPush()
        {
            if (CurrentStamina < 2f)
            {
                return;
            }
            nextAttackTime = Time.time + AttackCooldown;
            CurrentStamina -= 2f;
            if (Opponent == null)
            {
                return;
            }
            float distance = Vector3.Distance(transform.position, Opponent.transform.position);
            if (distance <= PushRange)
            {
                Vector3 dir = (Opponent.transform.position - transform.position).normalized;
                Opponent.ReceiveForce(dir * PushForce * GetPowerMultiplier());
                AudioManager.Instance?.PlayHit();
            }
        }

        void TryGrab()
        {
            if (CurrentStamina < 3f || isGrabbing || Opponent == null)
            {
                return;
            }
            float distance = Vector3.Distance(transform.position, Opponent.transform.position);
            if (distance <= GrabRange && !Opponent.IsKnockedDown)
            {
                isGrabbing = true;
                Opponent.OnGrabbed(this);
            }
            nextGrabTime = Time.time + GrabCooldown;
        }

        void ReleaseGrab()
        {
            if (Opponent != null)
            {
                Opponent.OnReleased();
            }
            isGrabbing = false;
        }

        void TryThrow()
        {
            if (!isGrabbing || Opponent == null || CurrentStamina < 4f)
            {
                return;
            }
            CurrentStamina -= 4f;
            Vector3 dir = (Opponent.transform.position - transform.position).normalized;
            Opponent.OnReleased();
            Opponent.ReceiveForce(dir * ThrowForce * GetPowerMultiplier());
            isGrabbing = false;
        }

        float GetPowerMultiplier()
        {
            if (Data == null)
            {
                return 1f;
            }
            return Mathf.Lerp(0.8f, 1.6f, Data.Stats.Power / 10f);
        }

        public void SetAIInput(WrestlerInput input)
        {
            aiInput = input;
        }

        public void ReceiveForce(Vector3 force)
        {
            if (IsKnockedDown)
            {
                return;
            }
            rb.AddForce(force / stabilityMultiplier, ForceMode.Impulse);
            DrainStamina(Mathf.Clamp(force.magnitude * 0.8f, 2f, 6f));
        }

        void DrainStamina(float amount)
        {
            CurrentStamina -= amount;
            if (CurrentStamina <= 0f)
            {
                CurrentStamina = 0f;
                EnterKnockdown();
            }
        }

        void EnterKnockdown()
        {
            IsKnockedDown = true;
            KnockdownTimer = 0f;
            rb.velocity = Vector3.zero;
        }

        public void ResetForRound()
        {
            IsKnockedDown = false;
            KnockdownTimer = 0f;
            isGrabbed = false;
            isGrabbing = false;
            specialActive = false;
            CurrentStamina = maxStamina;
            speedMultiplier = 1f;
            stabilityMultiplier = 1f;
        }

        public void OnGrabbed(WrestlerController grabber)
        {
            isGrabbed = true;
            currentGrabber = grabber;
            transform.position = grabber.transform.position + grabber.transform.forward * 0.8f;
        }

        public void OnReleased()
        {
            isGrabbed = false;
            currentGrabber = null;
        }

        IEnumerator PerformSpecial(SpecialMove special)
        {
            if (CurrentStamina < special.StaminaCost)
            {
                yield break;
            }

            CurrentStamina -= special.StaminaCost;
            specialReadyTime = Time.time + special.Cooldown;
            specialActive = true;

            switch (special.Type)
            {
                case SpecialType.Stonewall:
                    stabilityMultiplier = 2f;
                    yield return new WaitForSeconds(2.5f);
                    stabilityMultiplier = 1f;
                    break;
                case SpecialType.RootedStomp:
                    yield return new WaitForSeconds(0.35f);
                    ApplyAreaPush(2.2f, 10f);
                    break;
                case SpecialType.IronClinch:
                    GrabRange += 0.4f;
                    TryGrab();
                    yield return new WaitForSeconds(0.6f);
                    GrabRange -= 0.4f;
                    break;
                case SpecialType.MoltenCharge:
                    yield return new WaitForSeconds(0.2f);
                    ChargeForward(1.4f, 12f);
                    break;
                case SpecialType.EarthHand:
                    yield return new WaitForSeconds(0.2f);
                    ApplyStun(1.2f);
                    break;
                case SpecialType.GravelGrind:
                    yield return StartCoroutine(DrainOpponentStamina(2.5f, 1.2f));
                    break;
                case SpecialType.StormRoll:
                    ChargeForward(1.2f, 9f);
                    break;
                case SpecialType.BellyBoom:
                    yield return new WaitForSeconds(0.25f);
                    ApplyAreaPush(2.4f, 12f, true);
                    break;
                case SpecialType.ThunderClap:
                    yield return new WaitForSeconds(0.2f);
                    ApplyStun(1.4f);
                    break;
                case SpecialType.NovaBurst:
                    yield return new WaitForSeconds(0.2f);
                    ApplyAreaPush(2.6f, 14f);
                    break;
                case SpecialType.WhiplashThrow:
                    if (isGrabbing)
                    {
                        ThrowForce *= 1.6f;
                        TryThrow();
                        ThrowForce /= 1.6f;
                    }
                    else
                    {
                        GrabRange += 0.5f;
                        TryGrab();
                        yield return new WaitForSeconds(0.5f);
                        GrabRange -= 0.5f;
                    }
                    break;
                case SpecialType.StaticStep:
                    speedMultiplier = 1.8f;
                    nextDodgeTime = Time.time;
                    Vector3 dodgeDir = new Vector3(0f, 0f, Opponent != null && Opponent.transform.position.z > transform.position.z ? -1f : 1f);
                    rb.AddForce(dodgeDir * DodgeForce * 1.3f, ForceMode.Impulse);
                    yield return new WaitForSeconds(0.6f);
                    speedMultiplier = 1f;
                    break;
                default:
                    break;
            }

            specialActive = false;
        }

        void ApplyAreaPush(float radius, float force, bool knockdown = false)
        {
            if (Opponent == null)
            {
                return;
            }
            float distance = Vector3.Distance(transform.position, Opponent.transform.position);
            if (distance <= radius)
            {
                Vector3 dir = (Opponent.transform.position - transform.position).normalized;
                Opponent.ReceiveForce(dir * force * GetPowerMultiplier());
                if (knockdown)
                {
                    Opponent.DrainStamina(Opponent.CurrentStamina + 1f);
                }
            }
        }

        void ChargeForward(float duration, float force)
        {
            if (Opponent == null)
            {
                return;
            }
            Vector3 dir = (Opponent.transform.position - transform.position).normalized;
            rb.AddForce(dir * force, ForceMode.Impulse);
        }

        void ApplyStun(float seconds)
        {
            if (Opponent == null)
            {
                return;
            }
            float distance = Vector3.Distance(transform.position, Opponent.transform.position);
            if (distance <= PushRange + 0.5f)
            {
                Opponent.StartCoroutine(Opponent.StunRoutine(seconds));
            }
        }

        IEnumerator DrainOpponentStamina(float duration, float perSecond)
        {
            if (Opponent == null)
            {
                yield break;
            }
            float timer = 0f;
            while (timer < duration)
            {
                timer += Time.deltaTime;
                Opponent.DrainStamina(perSecond * Time.deltaTime);
                yield return null;
            }
        }

        IEnumerator StunRoutine(float seconds)
        {
            float timer = 0f;
            float prevSpeed = speedMultiplier;
            speedMultiplier = 0.2f;
            while (timer < seconds)
            {
                timer += Time.deltaTime;
                yield return null;
            }
            speedMultiplier = prevSpeed;
        }

        void ClampLane()
        {
            Vector3 pos = transform.position;
            pos.z = Mathf.Clamp(pos.z, -laneDepth, laneDepth);
            if (pos.y < 0f)
            {
                pos.y = 0f;
            }
            transform.position = pos;
        }
    }
}
