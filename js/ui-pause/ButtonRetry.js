Sunniesnow.ButtonRetry = class ButtonRetry extends Sunniesnow.ButtonResume {
	static async load() {
		await super.load()
		this.text = 'Retry';
	}

	populate() {
		super.populate();
		this.x = Sunniesnow.Config.WIDTH / 2;
	}

};
