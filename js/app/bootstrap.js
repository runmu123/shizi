    (() => {
      const refreshContext = window.ShiziRefresh?.getRefreshContext({ ensureLocalDevToken: true }) || {
        refreshToken: '',
        shouldForceRefresh: false,
        cacheSuffix: '',
      };
      const shouldForceRefresh = refreshContext.shouldForceRefresh;
      const suffix = refreshContext.cacheSuffix;
      const modules = [
        'js/app/main.js', 'js/app/state.js', 'js/app/app.js', 'js/app/menu.js', 'js/learning/learning.js',
        'js/ui/ui.js', 'js/utils/toast.js', 'js/app/constants.js', 'js/app/position.js',
        'js/batch/batch-record.js', 'js/batch/batch-play.js', 'js/app/level-data-loader.js',
        'js/batch/batch-shared.js', 'js/events/home-section-events.js',
        'js/events/practice-interaction-events.js', 'js/events/profile-notebook-events.js',
        'js/events/audio-interaction-events.js', 'js/events/navigation-events.js',
        'js/events/completion-modal-events.js', 'js/practice/practice-engine.js',
        'js/profile/notebook-engine.js', 'js/profile/notebook-support.js',
        'js/profile/notebook-grouping.js', 'js/profile/profile-data-support.js',
        'js/home/home-support.js',
        'js/practice/practice-state-support.js', 'js/practice/practice-playback-support.js',
        'js/ui/ui-icon-support.js',
        'js/home/learn-batch-support.js'
      ];

      // 强制刷新时，为 ES Module 依赖链注入统一时间戳映射
      // 这样 main.js 的静态 import 也会命中带后缀的新 URL
      if (shouldForceRefresh) {
        const imports = {};
        modules.forEach((path) => {
          const specifier = `./${path.replace('js/', '')}`;
          imports[specifier] = `./${path}${suffix}`;
        });
        imports['./state.js'] = `./js/app/state.js${suffix}`;
        imports['./constants.js'] = `./js/app/constants.js${suffix}`;
        imports['./position.js'] = `./js/app/position.js${suffix}`;
        imports['./app.js'] = `./js/app/app.js${suffix}`;
        imports['./menu.js'] = `./js/app/menu.js${suffix}`;
        imports['./platform-detector.js'] = `./js/app/platform-detector.js${suffix}`;
        imports['./level-data-loader.js'] = `./js/app/level-data-loader.js${suffix}`;
        imports['../utils/toast.js'] = `./js/utils/toast.js${suffix}`;
        imports['../ui/ui.js'] = `./js/ui/ui.js${suffix}`;
        imports['../learning/learning.js'] = `./js/learning/learning.js${suffix}`;
        imports['../batch/batch-record.js'] = `./js/batch/batch-record.js${suffix}`;
        imports['../batch/batch-play.js'] = `./js/batch/batch-play.js${suffix}`;
        imports['../utils/mistake-utils.js'] = `./js/utils/mistake-utils.js${suffix}`;
        imports['../events/home-section-events.js'] = `./js/events/home-section-events.js${suffix}`;
        imports['../events/practice-interaction-events.js'] = `./js/events/practice-interaction-events.js${suffix}`;
        imports['../events/profile-notebook-events.js'] = `./js/events/profile-notebook-events.js${suffix}`;
        imports['../events/audio-interaction-events.js'] = `./js/events/audio-interaction-events.js${suffix}`;
        imports['../events/navigation-events.js'] = `./js/events/navigation-events.js${suffix}`;
        imports['../events/completion-modal-events.js'] = `./js/events/completion-modal-events.js${suffix}`;
        imports['../practice/practice-engine.js'] = `./js/practice/practice-engine.js${suffix}`;
        imports['../practice/practice-state-support.js'] = `./js/practice/practice-state-support.js${suffix}`;
        imports['../practice/practice-playback-support.js'] = `./js/practice/practice-playback-support.js${suffix}`;
        imports['../profile/notebook-engine.js'] = `./js/profile/notebook-engine.js${suffix}`;
        imports['../profile/notebook-support.js'] = `./js/profile/notebook-support.js${suffix}`;
        imports['../profile/notebook-grouping.js'] = `./js/profile/notebook-grouping.js${suffix}`;
        imports['../profile/profile-data-support.js'] = `./js/profile/profile-data-support.js${suffix}`;
        imports['../home/home-support.js'] = `./js/home/home-support.js${suffix}`;
        imports['../home/learn-batch-support.js'] = `./js/home/learn-batch-support.js${suffix}`;
        imports['../ui/ui-icon-support.js'] = `./js/ui/ui-icon-support.js${suffix}`;
        imports['../app/state.js'] = `./js/app/state.js${suffix}`;
        imports['../app/constants.js'] = `./js/app/constants.js${suffix}`;
        imports['../app/app.js'] = `./js/app/app.js${suffix}`;

        const importMapScript = document.createElement('script');
        importMapScript.type = 'importmap';
        importMapScript.textContent = JSON.stringify({ imports });
        document.head.appendChild(importMapScript);
      }

      // 1. 注入 config.js (带有时间戳)
      const configScript = document.createElement('script');
      configScript.src = `js/app/config.js${suffix}`;
      configScript.async = false;
      document.head.appendChild(configScript);

      // 2. 注入 audio-manager.js (带有时间戳)，等待加载完成
      const audioScript = document.createElement('script');
      audioScript.src = `js/audio/audio-manager.js${suffix}`;
      audioScript.async = false;
      audioScript.onload = () => {
        // audio-manager.js 加载完成后，再加载 main.js
        const mainScript = document.createElement('script');
        mainScript.type = 'module';
        mainScript.src = `js/app/main.js${suffix}`;
        document.head.appendChild(mainScript);
      };
      document.head.appendChild(audioScript);

      // 3. 预加载核心模块
      modules.forEach(path => {
        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = `${path}${suffix}`;
        document.head.appendChild(link);
      });
    })();
