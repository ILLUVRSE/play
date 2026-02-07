using UnityEngine;

namespace IlluvrseWrestling.Core
{
    public class RingBoundary : MonoBehaviour
    {
        public float Radius = 6f;
        public Transform Center;

        void OnDrawGizmosSelected()
        {
            Vector3 center = Center != null ? Center.position : transform.position;
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(center, Radius);
        }

        public bool IsOut(Vector3 position)
        {
            Vector3 center = Center != null ? Center.position : transform.position;
            Vector2 flat = new Vector2(position.x - center.x, position.z - center.z);
            return flat.magnitude > Radius;
        }
    }
}
