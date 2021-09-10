export default class Timer {
    startTime!: number;
    thisFrameStart!: number;
    thisFrameDelta!: number;
    frameTimeMovingAverage!: number;
    frameCount!: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = performance.now() / 1000;
        this.thisFrameStart = this.startTime;
        this.frameTimeMovingAverage = 0.0166;
        this.thisFrameDelta = 0.0166;
        this.frameCount = 0;
    }

    newFrame() {
        const now = performance.now() / 1000;
        this.thisFrameDelta = now - this.thisFrameStart;
        this.thisFrameStart = now;
        this.frameTimeMovingAverage = (
            0.97 * this.frameTimeMovingAverage +
            0.03 * this.thisFrameDelta
        );
        this.frameCount += 1;

    }

    getDelta(): number {
        return this.thisFrameDelta;
    }

    getTotalElapsed(): number {
        return this.thisFrameStart - this.startTime;
    }

    getFPS(): number {
        return 1.0 / this.frameTimeMovingAverage;
    }
}