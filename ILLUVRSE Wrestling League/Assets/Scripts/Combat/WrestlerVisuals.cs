using UnityEngine;
using IlluvrseWrestling.Data;

namespace IlluvrseWrestling.Combat
{
    public class WrestlerVisuals : MonoBehaviour
    {
        public WrestlerData Data;
        public Renderer BodyRenderer;

        void Start()
        {
            Apply();
        }

        public void Apply()
        {
            if (Data == null || BodyRenderer == null)
            {
                return;
            }
            Material mat = new Material(BodyRenderer.sharedMaterial);
            mat.color = Data.PrimaryColor;
            BodyRenderer.material = mat;
        }
    }
}
