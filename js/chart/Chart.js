Sunniesnow.Chart = class Chart {

	static META_FIELDS = {
		title: '',
		artist: '',
		charter: '',
		difficultyName: 'Unknown',
		difficultyColor: '#7f7f7f',
		difficulty: ''
	}

	static EVENT_FIELDS = ['time', 'type', 'properties']
	
	static async load() {
		Sunniesnow.game.chart = new this(Sunniesnow.Loader.loaded.chart.charts[Sunniesnow.game.settings.chartSelect]);
	}

	constructor(data) {
		if (!data) {
			Sunniesnow.Utils.error('There is no chart');
		}
		this.data = data;
		this.readMeta();
		this.readEvents();
	}

	readMeta() {
		for (const field in Sunniesnow.Chart.META_FIELDS) {
			if (this.data[field]) {
				this[field] = this.data[field];
			} else {
				this[field] = Sunniesnow.Chart.META_FIELDS[field];
				Sunniesnow.Utils.warn(`Missing \`${field}\` in chart`);
			}
		}
	}

	readEvents() {
		this.events = [];
		const duration = Sunniesnow.Music.duration;
		const start = Sunniesnow.game.settings.start * duration - Sunniesnow.game.settings.resumePreperationTime;
		const end = Sunniesnow.game.settings.end * duration;
		for (const eventData of this.data.events) {
			const {type, time, properties} = this.readEventMeta(eventData);
			if (!Sunniesnow.Utils.between(time, start, end)) {
				continue;
			}
			const event = Sunniesnow.Event.newFromType(type, time, properties);
			event.id = this.events.length;
			this.events.push(event);
		}
		this.events.sort((a, b) => a.time - b.time);
		for (let i = 0; i < this.events.length - 1; i++) {
			const event1 = this.events[i];
			const event2 = this.events[i + 1];
			if (event1.time === event2.time) {
				event1.simultaneousEvents.push(event2);
				event2.simultaneousEvents = event1.simultaneousEvents;
			}
		}
	}

	readEventMeta(eventData) {
		const result = {}
		for (const field of Sunniesnow.Chart.EVENT_FIELDS) {
			result[field] = eventData[field];
			if (!Object.hasOwn(result, field)) {
				Sunniesnow.Utils.error(`Missing \`${field}\` in event`);
			}
		}
		return result;
	}

};
