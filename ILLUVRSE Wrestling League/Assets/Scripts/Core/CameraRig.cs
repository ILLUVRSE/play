using UnityEngine;

namespace IlluvrseWrestling.Core
{
    public class CameraRig : MonoBehaviour
    {
        public Transform TargetA;
        public Transform TargetB;
        public Vector3 Offset = new Vector3(0f, 8f, -8f);
        public float Smooth = 6f;

        void LateUpdate()
        {
            if (TargetA == null || TargetB == null)
            {
                return;
            }

            Vector3 center = (TargetA.position + TargetB.position) * 0.5f;
            Vector3 desired = center + Offset;
            transform.position = Vector3.Lerp(transform.position, desired, Smooth * Time.deltaTime);
        }
    }
}
