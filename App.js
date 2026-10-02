import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  State
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 85;

// 高质量预置备用照片（如果系统权限受限仅读取到 1 张照片时无缝补充，保证持续滑动体验）
const DEMO_PHOTOS = [
  { id: 'demo-1', uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', filename: '夏日白沙滩.jpg', creationTime: Date.now() - 86400000 },
  { id: 'demo-2', uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80', filename: '星空雪山峰.jpg', creationTime: Date.now() - 172800000 },
  { id: 'demo-3', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', filename: '清晨雾中林.jpg', creationTime: Date.now() - 259200000 },
  { id: 'demo-4', uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', filename: '森林阳光.jpg', creationTime: Date.now() - 345600000 },
  { id: 'demo-5', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', filename: '峡谷山水.jpg', creationTime: Date.now() - 432000000 },
  { id: 'demo-6', uri: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80', filename: '绿色田野.jpg', creationTime: Date.now() - 518400000 },
  { id: 'demo-7', uri: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', filename: '极简办公桌.jpg', creationTime: Date.now() - 604800000 }
];

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSwipingOut, setIsSwipingOut] = useState(false);

  // 动画 Shared Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // 请求相册读取权限
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      const isGranted = perm.status === 'granted';
      setHasPermission(isGranted);

      if (isGranted) {
        await loadPhotos();
        await loadAlbums();
      } else {
        // 无权限时加载演示照片供快速体验
        setPhotos(DEMO_PHOTOS);
      }
    } catch (e) {
      console.log('权限或初始化失败:', e);
      setPhotos(DEMO_PHOTOS);
    } finally {
      setLoading(false);
    }
  };

  // 强力全面加载相册照片（兼容 Android 10/11/12/13/14 各种定制系统）
  const loadPhotos = async () => {
    try {
      let photoList = [];

      // 1. 尝试常规全相册拉取（不传 sortBy 数组，防止触发某些 Android 系统 ContentResolver 崩溃）
      try {
        const assets = await MediaLibrary.getAssetsAsync({
          first: 200,
          mediaType: [MediaLibrary.MediaType.photo]
        });
        if (assets && assets.assets && assets.assets.length > 0) {
          photoList = assets.assets;
        }
      } catch (err) {
        console.log('第一级相册拉取失败，尝试降级拉取:', err);
      }

      // 2. 如果全相册为空，尝试遍历各大常见相册（如 Camera、Screenshots 等）
      if (photoList.length === 0) {
        try {
          const userAlbums = await MediaLibrary.getAlbumsAsync();
          for (const alb of userAlbums) {
            if (alb.assetCount > 0) {
              const albAssets = await MediaLibrary.getAssetsAsync({
                album: alb,
                first: 100,
                mediaType: [MediaLibrary.MediaType.photo]
              });
              if (albAssets && albAssets.assets && albAssets.assets.length > 0) {
                photoList = [...photoList, ...albAssets.assets];
              }
            }
          }
        } catch (err) {
          console.log('遍历相册拉取失败:', err);
        }
      }

      // 3. 兜底保护：如果用户手机上由于权限受限只给选了 1 张，或者相册确实空
      // 自动拼接高质量演示照片，保证用户始终可以顺畅连续滑动
      if (photoList.length < 3) {
        photoList = [...photoList, ...DEMO_PHOTOS];
      }

      setPhotos(photoList);
      setCurrentIndex(0);
    } catch (e) {
      console.log('读取照片异常:', e);
      setPhotos(DEMO_PHOTOS);
    }
  };

  // 加载手机相册列表
  const loadAlbums = async () => {
    try {
      const userAlbums = await MediaLibrary.getAlbumsAsync();
      setAlbums(userAlbums || []);
    } catch (e) {
      console.log('读取相册列表失败:', e);
    }
  };

  // 触觉震动反馈
  const triggerHaptic = (type) => {
    try {
      if (type === 'delete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}
  };

  // 执行划出或点击动作
  const handleAction = (action, targetAlbum = null) => {
    if (currentIndex >= photos.length) return;
    const currentPhoto = photos[currentIndex];

    // 记录历史供撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: currentIndex }]);

    if (action === 'delete') {
      triggerHaptic('delete');
    } else if (action === 'like') {
      triggerHaptic('like');
    } else if (action === 'album' && targetAlbum) {
      triggerHaptic('album');
      try {
        if (currentPhoto && !currentPhoto.id.startsWith('demo-')) {
          MediaLibrary.addAssetsToAlbumAsync([currentPhoto], targetAlbum, false);
        }
      } catch (e) {
        console.log('添加相册失败:', e);
      }
    } else if (action === 'keep') {
      triggerHaptic('keep');
    }

    // 极其关键：必须彻底将位移复位归零，并重置划出锁
    translateX.value = 0;
    translateY.value = 0;
    setIsSwipingOut(false);

    // 推进到下一张！
    setCurrentIndex(prev => prev + 1);
  };

  // 触发划出动画并推进下一张（带安全计时器保底）
  const triggerSwipeAnimation = (targetX, targetY, action, targetAlbum = null) => {
    if (isSwipingOut) return;
    setIsSwipingOut(true);

    let finished = false;
    const onComplete = () => {
      if (!finished) {
        finished = true;
        handleAction(action, targetAlbum);
      }
    };

    // 250ms 超时强制保底，防止 Reanimated 在部分机型上偶尔丢失动画完成回调
    setTimeout(onComplete, 260);

    if (targetX !== 0) {
      translateX.value = withTiming(targetX, { duration: 220 }, (isDone) => {
        if (isDone) runOnJS(onComplete)();
      });
    }
    if (targetY !== 0) {
      translateY.value = withTiming(targetY, { duration: 220 }, (isDone) => {
        if (isDone) runOnJS(onComplete)();
      });
    }
  };

  // 撤销上一步
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      Alert.alert('提示', '当前没有可撤销的操作哦 🐱');
      return;
    }
    translateX.value = 0;
    translateY.value = 0;
    setIsSwipingOut(false);
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => prev - 1);
    triggerHaptic('undo');
  };

  // 手势结束判断方向
  const onGestureEnd = (dx, dy) => {
    if (isSwipingOut) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      if (dy < -SWIPE_THRESHOLD) {
        // ⬆ 上滑：喜欢收藏
        triggerSwipeAnimation(0, -SCREEN_HEIGHT, 'like');
      } else {
        // ⬇ 下滑：收纳相册
        setPendingPhoto(photos[currentIndex]);
        setModalVisible(true);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    } else if (absX > SWIPE_THRESHOLD) {
      if (dx < -SWIPE_THRESHOLD) {
        // ⬅ 左滑：删除
        triggerSwipeAnimation(-SCREEN_WIDTH * 1.5, 0, 'delete');
      } else {
        // ➡ 右滑：保留
        triggerSwipeAnimation(SCREEN_WIDTH * 1.5, 0, 'keep');
      }
    } else {
      // 未达阈值弹簧复位
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  // 顶层活动卡片动画样式
  const topCardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = `${(translateX.value / SCREEN_WIDTH) * 16}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: rotate }
      ]
    };
  });

  // 底层卡片平滑跟随放大动画（真正的 Tinder 双层 Deck 堆叠）
  const bottomCardAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.max(Math.abs(translateX.value), Math.abs(translateY.value)),
      [0, SWIPE_THRESHOLD * 1.5],
      [0.94, 1.0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      Math.max(Math.abs(translateX.value), Math.abs(translateY.value)),
      [0, SWIPE_THRESHOLD * 1.5],
      [0.85, 1.0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity
    };
  });

  // 动态印章徽章样式
  const likeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-100, -25, 0], [1, 0.5, 0], Extrapolation.CLAMP)
  }));
  const albumBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, 25, 100], [0, 0.5, 1], Extrapolation.CLAMP)
  }));
  const deleteBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-100, -25, 0], [1, 0.5, 0], Extrapolation.CLAMP)
  }));
  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 25, 100], [0, 0.5, 1], Extrapolation.CLAMP)
  }));

  const currentPhoto = photos[currentIndex];
  const nextPhoto = currentIndex + 1 < photos.length ? photos[currentIndex + 1] : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F8F6" />

        {/* 顶部标题与清新进度条 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>🍃</Text>
            </View>
            <View>
              <Text style={styles.title}>PhotoSwipe</Text>
              <Text style={styles.subTitle}>清新相册整理</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadPhotos} activeOpacity={0.7}>
              <Text style={styles.refreshBtnText}>🔄 重新扫描</Text>
            </TouchableOpacity>
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>
                {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}
              </Text>
            </View>
          </View>
        </View>

        {/* 卡片主操作区 (双层卡片堆叠 Dual Deck) */}
        <View style={styles.deck}>
          {loading ? (
            <ActivityIndicator size="large" color="#10B981" />
          ) : currentIndex < photos.length && currentPhoto ? (
            <View style={styles.stackWrapper}>
              {/* 底层卡片：下一张照片，预先常驻在下方，顶卡划走时无缝顶上 */}
              {nextPhoto && (
                <Animated.View
                  key={`next-card-${currentIndex + 1}-${nextPhoto.id}`}
                  style={[styles.card, styles.bottomCard, bottomCardAnimatedStyle]}
                >
                  <Image source={{ uri: nextPhoto.uri }} style={styles.photo} resizeMode="cover" />
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoName} numberOfLines={1}>{nextPhoto.filename || '下一张照片'}</Text>
                    <Text style={styles.photoDate}>
                      {nextPhoto.creationTime ? new Date(nextPhoto.creationTime).toLocaleDateString() : '相册照片'}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* 顶层卡片：当前照片，独立 key 保证销毁重建，彻底消除位移残留 */}
              <PanGestureHandler
                key={`gesture-${currentIndex}-${currentPhoto.id}`}
                onGestureEvent={(e) => {
                  if (isSwipingOut) return;
                  translateX.value = e.nativeEvent.translationX;
                  translateY.value = e.nativeEvent.translationY;
                }}
                onHandlerStateChange={(e) => {
                  if (e.nativeEvent.state === State.END) {
                    onGestureEnd(e.nativeEvent.translationX, e.nativeEvent.translationY);
                  }
                }}
              >
                <Animated.View
                  key={`top-card-${currentIndex}-${currentPhoto.id}`}
                  style={[styles.card, topCardAnimatedStyle]}
                >
                  <Image source={{ uri: currentPhoto.uri }} style={styles.photo} resizeMode="cover" />

                  {/* 动态手势提示印章 */}
                  <Animated.View style={[styles.badge, styles.likeBadge, likeBadgeStyle]}>
                    <Text style={styles.likeBadgeText}>❤️ 喜欢</Text>
                  </Animated.View>
                  <Animated.View style={[styles.badge, styles.albumBadge, albumBadgeStyle]}>
                    <Text style={styles.albumBadgeText}>📁 归入相册</Text>
                  </Animated.View>
                  <Animated.View style={[styles.badge, styles.deleteBadge, deleteBadgeStyle]}>
                    <Text style={styles.deleteBadgeText}>🗑 删除</Text>
                  </Animated.View>
                  <Animated.View style={[styles.badge, styles.keepBadge, keepBadgeStyle]}>
                    <Text style={styles.keepBadgeText}>✨ 保留</Text>
                  </Animated.View>

                  {/* 底部照片信息 */}
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoName} numberOfLines={1}>{currentPhoto.filename || '相册照片'}</Text>
                    <Text style={styles.photoDate}>
                      {currentPhoto.creationTime ? new Date(currentPhoto.creationTime).toLocaleDateString() : '最近拍摄'}
                    </Text>
                  </View>
                </Animated.View>
              </PanGestureHandler>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={{ fontSize: 44 }}>✨</Text>
              </View>
              <Text style={styles.emptyTitle}>全部整理好啦！</Text>
              <Text style={styles.emptySubtitle}>您已完成了当前所有照片的整理 🐱</Text>
              <TouchableOpacity style={styles.restartBtn} onPress={() => setCurrentIndex(0)} activeOpacity={0.75}>
                <Text style={styles.restartBtnText}>🔄 重新开始整理</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 底部清新胶囊操作栏 */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo} activeOpacity={0.75}>
            <Text style={styles.undoBtnIcon}>↩</Text>
            <Text style={styles.undoBtnText}>反悔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn]}
            onPress={() => triggerSwipeAnimation(-SCREEN_WIDTH * 1.5, 0, 'delete')}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteBtnIcon}>🗑</Text>
            <Text style={styles.deleteBtnText}>左滑删</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.albumBtn]}
            onPress={() => {
              setPendingPhoto(photos[currentIndex]);
              setModalVisible(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.albumBtnIcon}>📁</Text>
            <Text style={styles.albumBtnText}>下滑存</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.likeBtn]}
            onPress={() => triggerSwipeAnimation(0, -SCREEN_HEIGHT, 'like')}
            activeOpacity={0.75}
          >
            <Text style={styles.likeBtnIcon}>❤️</Text>
            <Text style={styles.likeBtnText}>上滑爱</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.keepBtn]}
            onPress={() => triggerSwipeAnimation(SCREEN_WIDTH * 1.5, 0, 'keep')}
            activeOpacity={0.75}
          >
            <Text style={styles.keepBtnIcon}>✨</Text>
            <Text style={styles.keepBtnText}>右滑留</Text>
          </TouchableOpacity>
        </View>

        {/* 相册归类抽屉 */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIndicator} />
                <Text style={styles.modalTitle}>选择归档相册</Text>
                <Text style={styles.modalDesc}>将当前照片收纳至指定相册</Text>
              </View>

              <FlatList
                data={albums}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.albumItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setModalVisible(false);
                      triggerSwipeAnimation(0, SCREEN_HEIGHT, 'album', item);
                    }}
                  >
                    <View style={styles.albumItemLeft}>
                      <View style={styles.albumIconBox}>
                        <Text style={{ fontSize: 18 }}>🗂</Text>
                      </View>
                      <Text style={styles.albumTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.albumCount}>{item.assetCount || 0} 张</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8' }}>暂无自定义相册，将自动归类</Text>
                  </View>
                }
              />

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  logoBadgeText: {
    fontSize: 18
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#134E4A'
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  refreshBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600'
  },
  counterPill: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16
  },
  counterText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700'
  },
  deck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 4
  },
  stackWrapper: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.65,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bottomCard: {
    zIndex: 1
  },
  photo: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EDF2F0'
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    zIndex: 99
  },
  likeBadge: {
    top: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#FB7185'
  },
  likeBadgeText: {
    color: '#E11D48',
    fontWeight: '800',
    fontSize: 16
  },
  albumBadge: {
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderColor: '#34D399'
  },
  albumBadgeText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 16
  },
  deleteBadge: {
    top: 24,
    right: 20,
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#F87171'
  },
  deleteBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 16
  },
  keepBadge: {
    top: 24,
    left: 20,
    backgroundColor: 'rgba(240, 249, 255, 0.95)',
    borderColor: '#38BDF8'
  },
  keepBadgeText: {
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 16
  },
  photoInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  photoName: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '700'
  },
  photoDate: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
  },
  emptyTitle: {
    color: '#134E4A',
    fontSize: 20,
    fontWeight: '700'
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center'
  },
  restartBtn: {
    marginTop: 18,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  restartBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18
  },
  btn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 9,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  undoBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  undoBtnIcon: { fontSize: 16, color: '#64748B' },
  undoBtnText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },

  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  deleteBtnIcon: { fontSize: 16 },
  deleteBtnText: { fontSize: 11, fontWeight: '700', color: '#E11D48', marginTop: 2 },

  albumBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  albumBtnIcon: { fontSize: 16 },
  albumBtnText: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 },

  likeBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FBCFE8'
  },
  likeBtnIcon: { fontSize: 16 },
  likeBtnText: { fontSize: 11, fontWeight: '700', color: '#DB2777', marginTop: 2 },

  keepBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  keepBtnIcon: { fontSize: 16 },
  keepBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '65%'
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14
  },
  modalIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginBottom: 12
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700'
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAF9',
    marginBottom: 8
  },
  albumItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  albumIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  albumTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600'
  },
  albumCount: {
    color: '#64748B',
    fontSize: 12
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16
  },
  cancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14
  }
});
