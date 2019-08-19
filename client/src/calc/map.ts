import { setUpCanvas, createShader, createProgram, resize } from '../webgl';
import { multiply, projection, translation, scaling } from './maths';
import { zoom, offset, bindListeners, setupSlippyMap } from './slippyMap';
import { objects, colors } from './prepare';
import { Dict, Color, Object } from '../types';

type Buffer = {
  size: number;
  buffer: WebGLBuffer;
  color: Color;
};

type Scene = {
  buffers: Array<Buffer>;
  colorLocation: WebGLUniformLocation;
  matrixLocation: WebGLUniformLocation;
  positionLocation: GLint;
};

const vertex = `
  attribute vec4 a_position;
  uniform mat4 u_matrix;
  varying vec3 vbc;

  void main() {
    gl_Position = u_matrix * a_position;
  }
`;

const fragment = `
  precision mediump float;
  uniform vec3 u_color;

  void main() {
    gl_FragColor = vec4(u_color, 1);
  }
`;

export default () => {
  if (typeof window === 'undefined') return;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.cursor = 'grab';

  const div = document.createElement('div');
  const style =
    'position:absolute;bottom:3%;right:3%;font-size:11px;opacity:0.3;color:#fff;font-family:sans-serif;';
  div.setAttribute('style', style);
  div.innerHTML = '© OpenStreetMap contributors';
  document.body.appendChild(div);

  const setup = (
    gl: WebGLRenderingContext,
    program: WebGLShader,
    objects: Array<Object>,
    colors: Dict<Color>,
  ): Scene => {
    const [r, g, b] = colors.background;
    gl.clearColor(r, g, b, 1);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const matrixLocation = gl.getUniformLocation(program, 'u_matrix');
    const colorLocation = gl.getUniformLocation(program, 'u_color');

    if (matrixLocation === null) {
      throw new Error('Failed to get uniform location');
    }
    if (colorLocation === null) {
      throw new Error('Failed to get uniform location');
    }

    const buffers: Array<Buffer> = objects.map(object => {
      const { vertices } = object;
      const buffer = gl.createBuffer();
      if (buffer === null) {
        throw new Error('Failed to create buffer');
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array((vertices as unknown) as ArrayLike<number>),
        gl.STATIC_DRAW,
      );
      return { size: vertices.length, buffer, color: object.color };
    });

    return {
      buffers,
      colorLocation,
      matrixLocation,
      positionLocation,
    };
  };

  const draw = (
    gl: WebGLRenderingContext,
    program: WebGLShader,
    scene: Scene,
  ) => {
    resize(gl);
    const density = window.devicePixelRatio;
    const width = gl.canvas.width / density;
    const height = gl.canvas.height / density;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    const pX = width * Math.pow(1.01, zoom);
    const pY = height * Math.pow(1.01, zoom);
    const p = projection(pX, pY, 1);
    const v = translation(-offset.x, -offset.y, 0);
    const m = multiply(scaling(1, -1, 1), translation(0, -height, 0));
    const matrix = multiply(p, v, m);
    gl.uniformMatrix4fv(scene.matrixLocation, false, matrix);

    for (let i = scene.buffers.length - 1; i >= 0; i--) {
      const [r, g, b] = scene.buffers[i].color;
      gl.uniform3f(scene.colorLocation, r, g, b);

      gl.bindBuffer(gl.ARRAY_BUFFER, scene.buffers[i].buffer);
      gl.enableVertexAttribArray(scene.positionLocation);
      gl.vertexAttribPointer(scene.positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, scene.buffers[i].size / 2);
    }
  };

  const canvas = setUpCanvas();
  const gl = canvas.getContext('webgl');
  if (gl === null) {
    throw new Error('Failed to setup GL context');
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragment);
  const program = createProgram(gl, vertexShader, fragmentShader);
  const scene = setup(gl, program, objects, colors);
  const render = () => draw(gl, program, scene);

  setupSlippyMap(render, 5, [-200, 50]);
  bindListeners();
  render();
};
