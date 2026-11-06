/* =====================================================================
   postfx.js — cinematic post-processing chain (custom, no extra libs):
   scene → MSAA HDR target → bright-pass → separable blur (2 scales)
   → composite: bloom, colour grading (split-toning, contrast, saturation),
   subtle chromatic aberration, vignette, film grain, sRGB output.
   ===================================================================== */
'use strict';
BV.PostFX = class {
  constructor(renderer) {
    this.r = renderer; this.enabled = true;
    const gl2 = renderer.capabilities.isWebGL2;
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true };
    this.rtScene = gl2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(1, 1, opts) : new THREE.WebGLRenderTarget(1, 1, opts);
    if (this.rtScene.samples !== undefined) this.rtScene.samples = 4;
    const small = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rt = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(1, 1, small));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.mBright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: 0.72 }, knee: { value: 0.35 } }, vertexShader: vs,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float threshold, knee; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(max(c.r,c.g),c.b);
          float s = clamp((l - threshold + knee) / (2.0*knee), 0.0, 1.0); s = s*s*knee*2.0;
          float w = max(s, l - threshold) / max(l, 1e-4); gl_FragColor = vec4(c * w, 1.0); }`,
      depthTest: false, depthWrite: false
    });
    this.mBlur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
          c += texture2D(tDiffuse, vUv + dir*1.3846).rgb * 0.316216; c += texture2D(tDiffuse, vUv - dir*1.3846).rgb * 0.316216;
          c += texture2D(tDiffuse, vUv + dir*3.2308).rgb * 0.070270; c += texture2D(tDiffuse, vUv - dir*3.2308).rgb * 0.070270;
          gl_FragColor = vec4(c, 1.0); }`,
      depthTest: false, depthWrite: false
    });
    this.mComp = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, time: { value: 0 },
        bloom: { value: 0.55 }, res: { value: new THREE.Vector2(1, 1) }, hurt: { value: 0 }, grain: { value: 0.035 }
      }, vertexShader: vs,
      fragmentShader: `uniform sampler2D tScene, tBloomA, tBloomB; uniform float time, bloom, hurt, grain; uniform vec2 res; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec2 d = vUv - 0.5; float r2 = dot(d, d);
          // subtle lens chromatic aberration toward the edges
          vec2 off = d * r2 * 0.012;
          vec3 c; c.r = texture2D(tScene, vUv + off).r; c.g = texture2D(tScene, vUv).g; c.b = texture2D(tScene, vUv - off).b;
          vec3 b = texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8;
          c += b * bloom;
          // colour grading: cool shadows, warm highlights, gentle S-curve and saturation
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(c, c * vec3(0.92, 0.98, 1.08), (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
          c = mix(c, c * vec3(1.06, 1.0, 0.9), smoothstep(0.45, 1.0, l) * 0.45);
          c = mix(vec3(l), c, 1.08);
          vec3 s = toSRGB(c);
          s = mix(s, s * s * (3.0 - 2.0 * s), 0.22);
          // vignette + damage tint
          float v = smoothstep(0.85, 0.2, r2 * 1.6);
          s *= mix(0.62, 1.0, v);
          s = mix(s, s * vec3(1.25, 0.55, 0.5), hurt * (1.0 - v * 0.6));
          // film grain
          s += (hash(vUv * res + fract(time) * 91.7) - 0.5) * grain;
          gl_FragColor = vec4(s, 1.0); }`,
      depthTest: false, depthWrite: false
    });
    this.w = 1; this.h = 1;
  }
  setSize(w, h, pr) {
    const W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
    this.w = W; this.h = H;
    this.rtScene.setSize(W, H);
    this.rt[0].setSize(W >> 2, H >> 2); this.rt[1].setSize(W >> 2, H >> 2);
    this.rt[2].setSize(W >> 3, H >> 3); this.rt[3].setSize(W >> 3, H >> 3);
    this.mComp.uniforms.res.value.set(W, H);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  begin() { this.r.setRenderTarget(this.rtScene); this.r.clear(); }
  end(dt, hurt) {
    const r = this.r, U = this.mBlur.uniforms;
    this.mBright.uniforms.tDiffuse.value = this.rtScene.texture; this.pass(this.mBright, this.rt[0]);
    const blur = (a, b, w, h, k) => {
      U.tDiffuse.value = a.texture; U.dir.value.set(k / w, 0); this.pass(this.mBlur, b);
      U.tDiffuse.value = b.texture; U.dir.value.set(0, k / h); this.pass(this.mBlur, a);
    };
    blur(this.rt[0], this.rt[1], this.rt[0].width, this.rt[0].height, 1.0);
    blur(this.rt[0], this.rt[1], this.rt[0].width, this.rt[0].height, 2.0);
    U.tDiffuse.value = this.rt[0].texture; this.pass(this.mBlur, this.rt[2]);   // downsample
    blur(this.rt[2], this.rt[3], this.rt[2].width, this.rt[2].height, 1.5);
    blur(this.rt[2], this.rt[3], this.rt[2].width, this.rt[2].height, 3.0);
    const C = this.mComp.uniforms;
    C.tScene.value = this.rtScene.texture; C.tBloomA.value = this.rt[0].texture; C.tBloomB.value = this.rt[2].texture;
    C.time.value += dt; C.hurt.value = hurt || 0;
    this.pass(this.mComp, null);
  }
};
