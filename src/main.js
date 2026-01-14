import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d'

// Level data - obstacles defined as simple objects
const LEVEL_1 = {
  spawn: { x: -8, y: 1, z: 0 },
  obstacles: [
    // Ramp to launch off
    { type: 'box', position: { x: -5, y: 0.3, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, rotation: { z: -0.2 }, color: 0x8B4513 },
    // Floating platforms
    { type: 'box', position: { x: 0, y: 2, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, color: 0x8B4513 },
    { type: 'box', position: { x: 4, y: 3, z: -1 }, size: { x: 1.5, y: 0.3, z: 1.5 }, color: 0x8B4513 },
    // Bouncy wall
    { type: 'box', position: { x: 6, y: 1.5, z: 0 }, size: { x: 0.3, y: 3, z: 3 }, color: 0xff6b6b, bouncy: true },
    // Steps
    { type: 'box', position: { x: -2, y: 0.5, z: 3 }, size: { x: 1, y: 0.5, z: 1 }, color: 0x696969 },
    { type: 'box', position: { x: -1, y: 1, z: 3 }, size: { x: 1, y: 1, z: 1 }, color: 0x696969 },
    { type: 'box', position: { x: 0, y: 1.5, z: 3 }, size: { x: 1, y: 1.5, z: 1 }, color: 0x696969 },
  ],
}

// Current level
const currentLevel = LEVEL_1

// Game state
let isDragging = false
let isLaunched = false
let dragStart = new THREE.Vector2()
let dragEnd = new THREE.Vector2()

// Physics world
const gravity = { x: 0, y: -9.81, z: 0 }
const world = new RAPIER.World(gravity)

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb) // Sky blue

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 8, 15)
camera.lookAt(0, 2, 0)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 10, 5)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 2048
directionalLight.shadow.mapSize.height = 2048
directionalLight.shadow.camera.left = -20
directionalLight.shadow.camera.right = 20
directionalLight.shadow.camera.top = 20
directionalLight.shadow.camera.bottom = -20
scene.add(directionalLight)

// Character (placeholder - chubby kid with backpack)
const character = new THREE.Group()

// Body - slightly squashed sphere for chubby look
const bodyGeometry = new THREE.SphereGeometry(0.6, 32, 32)
bodyGeometry.scale(1, 0.9, 0.85)
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 })
const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
body.castShadow = true
character.add(body)

// Backpack - red/blue for Spiderman vibes
const backpackGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.3)
const backpackMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 })
const backpack = new THREE.Mesh(backpackGeometry, backpackMaterial)
backpack.position.set(0, 0, -0.45)
backpack.castShadow = true
character.add(backpack)

// Blue stripes on backpack
const stripeGeometry = new THREE.BoxGeometry(0.08, 0.5, 0.32)
const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x0044cc })
const leftStripe = new THREE.Mesh(stripeGeometry, stripeMaterial)
leftStripe.position.set(-0.15, 0, -0.45)
character.add(leftStripe)
const rightStripe = new THREE.Mesh(stripeGeometry, stripeMaterial)
rightStripe.position.set(0.15, 0, -0.45)
character.add(rightStripe)

const spawnPoint = currentLevel.spawn
character.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z)
scene.add(character)

// Character physics (dynamic ball)
const characterBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(spawnPoint.x, spawnPoint.y, spawnPoint.z)
  .setLinearDamping(0.3)
  .setAngularDamping(0.3)
const characterBody = world.createRigidBody(characterBodyDesc)

const characterColliderDesc = RAPIER.ColliderDesc.ball(0.6)
  .setRestitution(0.7)
  .setFriction(0.5)
world.createCollider(characterColliderDesc, characterBody)

// Start with character asleep (no physics until launched)
characterBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased)

// Ground
const groundGeometry = new THREE.PlaneGeometry(50, 50)
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x7cba3d,
  roughness: 0.8,
})
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Ground physics (static)
const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
const groundBody = world.createRigidBody(groundBodyDesc)

const groundColliderDesc = RAPIER.ColliderDesc.cuboid(25, 0.1, 25)
  .setTranslation(0, -0.1, 0)
world.createCollider(groundColliderDesc, groundBody)

// Spawn level obstacles
function spawnObstacles(level) {
  level.obstacles.forEach((obs) => {
    if (obs.type === 'box') {
      // Three.js mesh
      const geometry = new THREE.BoxGeometry(obs.size.x * 2, obs.size.y * 2, obs.size.z * 2)
      const material = new THREE.MeshStandardMaterial({ color: obs.color || 0x888888 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(obs.position.x, obs.position.y, obs.position.z)
      if (obs.rotation) {
        mesh.rotation.set(obs.rotation.x || 0, obs.rotation.y || 0, obs.rotation.z || 0)
      }
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)

      // Rapier physics
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(obs.position.x, obs.position.y, obs.position.z)
      if (obs.rotation) {
        const euler = new THREE.Euler(obs.rotation.x || 0, obs.rotation.y || 0, obs.rotation.z || 0)
        const quat = new THREE.Quaternion().setFromEuler(euler)
        bodyDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      }
      const rigidBody = world.createRigidBody(bodyDesc)

      const colliderDesc = RAPIER.ColliderDesc.cuboid(obs.size.x, obs.size.y, obs.size.z)
        .setRestitution(obs.bouncy ? 1.2 : 0.3)
        .setFriction(obs.bouncy ? 0.1 : 0.5)
      world.createCollider(colliderDesc, rigidBody)
    }
  })
}

spawnObstacles(currentLevel)

// Aim line
const aimLineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
const aimLineGeometry = new THREE.BufferGeometry()
const aimLine = new THREE.Line(aimLineGeometry, aimLineMaterial)
aimLine.visible = false
scene.add(aimLine)

// Helper to convert screen coords to world direction
function screenToLaunchVector(startX, startY, endX, endY) {
  const dx = startX - endX
  const dy = startY - endY

  // Scale the drag distance to launch power
  const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.05, 20)

  // Convert 2D drag to 3D launch vector (pull back = launch forward)
  return new THREE.Vector3(dx * 0.05, dy * 0.05 + power * 0.5, -power * 0.3)
}

// Update aim line visualization
function updateAimLine() {
  if (!isDragging) {
    aimLine.visible = false
    return
  }

  const launchVec = screenToLaunchVector(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y)
  const charPos = new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z)

  // Show trajectory hint
  const points = []
  points.push(charPos)
  points.push(charPos.clone().add(launchVec.clone().multiplyScalar(0.5)))

  aimLineGeometry.setFromPoints(points)
  aimLine.visible = true
}

// Launch the character
function launch() {
  if (isLaunched) return

  const launchVec = screenToLaunchVector(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y)

  // Make character dynamic again
  characterBody.setBodyType(RAPIER.RigidBodyType.Dynamic)

  // Apply impulse
  characterBody.applyImpulse({ x: launchVec.x * 2, y: launchVec.y * 2, z: launchVec.z * 2 }, true)

  isLaunched = true
  aimLine.visible = false
}

// Reset character to spawn
function reset() {
  characterBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased)
  characterBody.setTranslation(spawnPoint)
  characterBody.setRotation({ x: 0, y: 0, z: 0, w: 1 })
  characterBody.setLinvel({ x: 0, y: 0, z: 0 })
  characterBody.setAngvel({ x: 0, y: 0, z: 0 })

  character.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z)
  character.quaternion.set(0, 0, 0, 1)

  isLaunched = false
  isDragging = false
  aimLine.visible = false
}

// Mouse/touch events
renderer.domElement.addEventListener('mousedown', (e) => {
  if (isLaunched) return
  isDragging = true
  dragStart.set(e.clientX, e.clientY)
  dragEnd.set(e.clientX, e.clientY)
})

renderer.domElement.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  dragEnd.set(e.clientX, e.clientY)
  updateAimLine()
})

renderer.domElement.addEventListener('mouseup', () => {
  if (isDragging && !isLaunched) {
    launch()
  }
  isDragging = false
})

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    reset()
  }
})

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Step physics
  world.step()

  // Sync character position from physics
  const pos = characterBody.translation()
  const rot = characterBody.rotation()
  character.position.set(pos.x, pos.y, pos.z)
  character.quaternion.set(rot.x, rot.y, rot.z, rot.w)

  renderer.render(scene, camera)
}

animate()
